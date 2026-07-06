import {
  useState, useEffect, useMemo, useRef,
  useCallback, type FormEvent, type DragEvent, type ClipboardEvent,
  Fragment,
} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  useInbox, useDebounced,
  type AgentInboxFilter, type ConversationSummary, type InboxListFilter,
} from '../hooks/useInbox'
import { useChatMessages } from '../hooks/useChatMessages'
import { useTypingEmitter, useTypingIndicator } from '../hooks/useTypingIndicator'
import { useMessageNotifications } from '../hooks/useMessageNotifications'
import { api } from '../api/client'
import MessageBubble from '../components/MessageBubble'
import ConnectionBanner, { ConnectionStatus } from '../components/ConnectionBanner'
import TypingIndicator from '../components/TypingIndicator'
import SoundToggle from '../components/SoundToggle'
import WhatsAppChannelBadge from '../components/WhatsAppChannelBadge'

// ─── helpers ────────────────────────────────────────────────────────────────

function phoneInitials(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const n = digits.length
  if (n < 2) return '?'
  return (digits[n - 4] + digits[n - 3]).toUpperCase()
}

function contactInitials(name: string | null | undefined, phone: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  }
  return phoneInitials(phone)
}

const AVATAR_COLORS = [
  '#7c3aed', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#2563eb', '#db2777', '#65a30d',
]

function avatarColor(phone: string): string {
  let h = 0
  for (let i = 0; i < phone.length; i++) h = (h * 31 + phone.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

/** G7 — date separator label */
function dateSepLabel(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (d.getTime() === today.getTime()) return 'Hoy'
  if (d.getTime() === yesterday.getTime()) return 'Ayer'
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export type AdminInboxFilter = 'all' | 'bot' | 'assigned'

function matchesAdminFilter(conv: ConversationSummary, filter: AdminInboxFilter): boolean {
  if (filter === 'bot') return conv.mode === 'bot'
  if (filter === 'assigned') return conv.mode === 'human' && conv.assignedAgentId !== null
  return true
}

function matchesSearch(conv: ConversationSummary, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  const name = (conv.contactName ?? '').toLowerCase()
  const phone = conv.phoneNumber.toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  const phoneDigits = conv.phoneNumber.replace(/\D/g, '')
  return (
    name.includes(needle) ||
    phone.includes(needle) ||
    (qDigits.length > 0 && phoneDigits.includes(qDigits))
  )
}

function matchesLabelFilter(conv: ConversationSummary, label: string): boolean {
  const needle = label.trim().toLowerCase()
  if (!needle) return true
  return (conv.labels ?? []).some((l) => l.toLowerCase().includes(needle))
}

/** Sync with ALLOWED_AGENT_MEDIA_MIMES (agent-media-upload.middleware.ts) */
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain',
  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr',
  'audio/wav', 'audio/x-wav', 'audio/webm',
  'video/mp4', 'video/3gpp', 'video/quicktime', 'video/x-msvideo',
])

const ACCEPT_DOCS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt',
].join(',')

const ACCEPT_MEDIA = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/3gpp,video/quicktime,video/x-msvideo,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.3gp'

function isAllowedFile(file: File): boolean {
  return ALLOWED_MIME.has(file.type)
}

function fileKindLabel(file: File): string {
  if (file.type.startsWith('image/')) return 'imagen'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  return 'documento'
}

function filePreviewEmoji(file: File): string {
  if (file.type.startsWith('image/')) return '🖼 '
  if (file.type.startsWith('audio/')) return '🎵 '
  if (file.type.startsWith('video/')) return '🎬 '
  return '📄 '
}

// ─── Label chip colors (cycle through palette) ───────────────────────────────
const LABEL_COLORS = [
  '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#2563eb', '#db2777', '#65a30d', '#7c2d12', '#1e40af',
]
function labelColor(label: string): string {
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0
  return LABEL_COLORS[h % LABEL_COLORS.length]
}

// ─── Date separator ──────────────────────────────────────────────────────────
function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="dash-date-sep">
      <span>{dateSepLabel(date)}</span>
    </div>
  )
}

// ─── Reassign modal ───────────────────────────────────────────────────────────
interface AgentOption { id: string; name: string; role: string }

function ReassignModal({
  conversationId,
  onClose,
  onSuccess,
}: {
  conversationId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [selected, setSelected] = useState('')
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get<{ agents: AgentOption[] }>('/api/v1/agents')
      .then((d) => { setAgents(d.agents); setLoadingAgents(false) })
      .catch(() => { setErr('Error al cargar agentes'); setLoadingAgents(false) })
  }, [])

  async function handleConfirm() {
    if (!selected) return
    setSaving(true)
    setErr('')
    try {
      await api.post(`/api/v1/conversations/${conversationId}/reassign`, { agentId: selected })
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al reasignar')
      setSaving(false)
    }
  }

  return (
    <div className="dash-modal-overlay" onClick={onClose}>
      <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal-header">
          <h3 className="dash-modal-title">Reasignar conversación</h3>
          <button className="dash-modal-close" onClick={onClose}>✕</button>
        </div>
        {err && <p className="dash-send-error" style={{ padding: '0 .5rem' }}>{err}</p>}
        <div className="dash-modal-body">
          {loadingAgents ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
              <span className="spinner" />
            </div>
          ) : (
            <ul className="dash-agent-list">
              {agents.map((a) => (
                <li
                  key={a.id}
                  className={`dash-agent-option${selected === a.id ? ' dash-agent-option--selected' : ''}`}
                  onClick={() => setSelected(a.id)}
                >
                  <span className="dash-agent-option-name">{a.name}</span>
                  {a.role === 'admin' && <span className="dash-agent-option-role">Admin</span>}
                </li>
              ))}
              {agents.length === 0 && (
                <li style={{ padding: '.75rem', color: 'var(--dash-muted)', fontSize: '.85rem' }}>
                  Sin agentes activos
                </li>
              )}
            </ul>
          )}
        </div>
        <div className="dash-modal-footer">
          <button className="dash-filter-btn" onClick={onClose}>Cancelar</button>
          <button
            className="dash-take-btn"
            style={{ flex: 1 }}
            onClick={handleConfirm}
            disabled={!selected || saving || loadingAgents}
          >
            {saving ? '…' : 'Reasignar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick replies popover ────────────────────────────────────────────────────
interface QuickReply { id: string; title: string; body: string }

function QuickRepliesPopover({
  onSelect,
  onClose,
  anchorRef,
}: {
  onSelect: (body: string) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}) {
  const [replies, setReplies] = useState<QuickReply[]>([])
  const [loading, setLoading] = useState(true)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get<{ quickReplies: QuickReply[] }>('/api/v1/quick-replies')
      .then((d) => { setReplies(d.quickReplies); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        popRef.current && !popRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose, anchorRef])

  return (
    <div ref={popRef} className="dash-qr-popover">
      <div className="dash-qr-header">
        <span>Respuestas rápidas</span>
        <button className="dash-modal-close" onClick={onClose}>✕</button>
      </div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
          <span className="spinner" style={{ width: 20, height: 20 }} />
        </div>
      ) : replies.length === 0 ? (
        <p style={{ padding: '.75rem', color: 'var(--dash-muted)', fontSize: '.82rem' }}>
          Sin respuestas rápidas configuradas
        </p>
      ) : (
        <ul className="dash-qr-list">
          {replies.map((r) => (
            <li key={r.id} className="dash-qr-item" onClick={() => { onSelect(r.body); onClose() }}>
              <span className="dash-qr-title">{r.title}</span>
              <span className="dash-qr-preview">{r.body.length > 80 ? r.body.slice(0, 80) + '…' : r.body}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Sidebar item ─────────────────────────────────────────────────────────────

function ConvItem({
  conv, active, onClick, showAssignedAgent,
}: {
  conv: ConversationSummary
  active: boolean
  onClick: () => void
  showAssignedAgent?: boolean
}) {
  const hasUnread = conv.unreadCountAgent > 0
  const lastActivity = conv.lastUserMessageAt ?? conv.updatedAt
  const isArchived = Boolean(conv.archivedAt)

  return (
    <li
      className={
        `dash-conv-item` +
        (active ? ' dash-conv-item--active' : '') +
        (hasUnread ? ' dash-conv-item--unread' : '') +
        (isArchived ? ' dash-conv-item--archived' : '')
      }
      onClick={onClick}
    >
      <div className="dash-avatar" style={{ background: avatarColor(conv.phoneNumber) }}>
        {contactInitials(conv.contactName, conv.phoneNumber)}
      </div>
      <div className="dash-conv-body">
        <div className="dash-conv-row dash-conv-row--top">
          <div className="dash-conv-name-row">
            {conv.pinned && (
              <span className="dash-pin-icon" title="Fijado">
                <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11">
                  <path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
                </svg>
              </span>
            )}
            <span className="dash-conv-name" title={conv.phoneNumber}>
              {conv.contactName ?? conv.phoneNumber}
            </span>
            <WhatsAppChannelBadge compact />
          </div>
          <div className="dash-conv-meta">
            <span className="dash-conv-time">{formatTime(lastActivity)}</span>
            {hasUnread && <span className="dash-badge">{conv.unreadCountAgent}</span>}
          </div>
        </div>
        <div className="dash-conv-row dash-conv-row--bottom">
          <span className="dash-conv-preview">
            {conv.contactName && (
              <span className="dash-conv-phone-inline">{conv.phoneNumber}</span>
            )}
            {conv.lastMessagePreview ??
              (conv.mode === 'human'
                ? showAssignedAgent && conv.assignedAgentName
                  ? `Asignado: ${conv.assignedAgentName}`
                  : 'En atención'
                : 'En bot')}
          </span>
        </div>
        {conv.labels && conv.labels.length > 0 && (
          <div className="dash-conv-labels">
            {conv.labels.map((l) => (
              <span key={l} className="dash-label-chip" style={{ background: labelColor(l) + '33', color: labelColor(l), borderColor: labelColor(l) + '66' }}>
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({
  id, onBack, readOnly, botPreview, onTakeSuccess, onMutated, isAdminPanel,
}: {
  id: string
  onBack: () => void
  readOnly?: boolean
  botPreview?: boolean
  onTakeSuccess?: () => void
  onMutated?: () => void
  isAdminPanel?: boolean
}) {
  const { agent } = useAuth()
  const {
    messages, meta, setMeta, loading, error, forbidden, reload,
    addOptimisticMessage, markOptimisticFailed,
  } = useChatMessages(id)

  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [taking, setTaking] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isNoteMode, setIsNoteMode] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileMediaRef = useRef<HTMLInputElement>(null)
  const attachBtnRef = useRef<HTMLButtonElement>(null)
  const qrBtnRef = useRef<HTMLButtonElement>(null)

  // Close attach menu when clicking outside
  useEffect(() => {
    if (!showAttachMenu) return
    function onDocClick(e: MouseEvent) {
      if (attachBtnRef.current && !attachBtnRef.current.closest('.dash-attach-wrap')?.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showAttachMenu])

  const isBotPreview = botPreview === true && meta?.mode === 'bot'
  const canReply = !readOnly && !isBotPreview
  const csWindowOpen = meta?.csWindowOpen ?? true
  const windowBlocked = canReply && !csWindowOpen
  const isPinned = meta?.pinned ?? false
  const isArchived = Boolean(meta?.archivedAt)

  useTypingEmitter(id, text, canReply && !isNoteMode)
  const typingAgent = useTypingIndicator(id)

  useEffect(() => {
    if (id && canReply) {
      api.post(`/api/v1/conversations/${id}/read`, {}).catch(() => void 0)
    }
  }, [id, canReply])

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    if (nearBottomRef.current || loading) el.scrollTop = el.scrollHeight
  }, [messages, loading, typingAgent])

  function handleMessagesScroll() {
    const el = messagesRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }

  // ─── Pin ──────────────────────────────────────────────────────────────────
  async function handlePin() {
    try {
      const pinned = !isPinned
      await api.post(`/api/v1/conversations/${id}/pin`, { pinned })
      setMeta((prev) => prev ? { ...prev, pinned } : prev)
      onMutated?.()
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 404) {
        alert('Fijar chat no disponible en el servidor actual. Se requiere deploy con Paq2 (pin/labels).')
        return
      }
      alert(err.message || 'Error al fijar')
    }
  }

  // ─── Archive ──────────────────────────────────────────────────────────────
  async function handleArchive() {
    const action = isArchived ? 'unarchive' : 'archive'
    const confirm = window.confirm(
      isArchived
        ? '¿Desarchivar esta conversación?'
        : '¿Archivar esta conversación? Dejará de aparecer en el inbox por defecto.'
    )
    if (!confirm) return
    try {
      const res = await api.post<{ archivedAt: string | null }>(`/api/v1/conversations/${id}/${action}`, {})
      setMeta((prev) => prev ? { ...prev, archivedAt: res.archivedAt } : prev)
      onMutated?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al archivar')
    }
  }

  // ─── Drag & drop ──────────────────────────────────────────────────────────
  function handleDragOver(e: DragEvent) { e.preventDefault(); setIsDragging(true) }
  function handleDragLeave() { setIsDragging(false) }
  function handleDrop(e: DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && isAllowedFile(file)) { setPendingFile(file); setSendError('') }
    else if (file) setSendError('Tipo no permitido. Usa imagen, PDF, audio o video MP4.')
  }

  // ─── Paste ────────────────────────────────────────────────────────────────
  function handlePaste(e: ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.kind === 'file' && i.type.startsWith('image/'))
    if (!item) return
    const file = item.getAsFile()
    if (file && isAllowedFile(file)) { e.preventDefault(); setPendingFile(file); setSendError('') }
  }

  function handleAttachClick() { setShowAttachMenu((v) => !v) }
  function handlePickDocs() { setShowAttachMenu(false); fileInputRef.current?.click() }
  function handlePickMedia() { setShowAttachMenu(false); fileMediaRef.current?.click() }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && isAllowedFile(file)) { setPendingFile(file); setSendError('') }
    else if (file) setSendError('Tipo no permitido. Usa documentos o fotos/videos permitidos.')
    e.target.value = ''
  }

  // ─── Send ─────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!agent || (windowBlocked && !isNoteMode)) return
    const caption = text.trim()
    if (!pendingFile && !caption) return
    setSendError('')

    const label = pendingFile
      ? `[${fileKindLabel(pendingFile)}] ${caption}`
      : caption
    const optimisticId = addOptimisticMessage(isNoteMode ? `📝 ${caption}` : label, agent.id)
    setText('')
    const fileToSend = pendingFile
    setPendingFile(null)
    setSending(true)
    nearBottomRef.current = true

    try {
      if (isNoteMode) {
        await api.post(`/api/v1/conversations/${id}/notes`, { content: caption })
      } else if (fileToSend) {
        const form = new FormData()
        if (caption) form.append('content', caption)
        form.append('file', fileToSend, fileToSend.name)
        await api.postFormData(`/api/v1/conversations/${id}/messages`, form)
      } else {
        await api.post(`/api/v1/conversations/${id}/messages`, { content: caption })
      }
    } catch (err) {
      markOptimisticFailed(optimisticId)
      const e = err as Error & { status?: number }
      if (e.status === 409) {
        setSendError(e.message)
      } else if (e.status === 403) {
        setSendError('No tienes permiso para responder en este chat.')
      } else {
        setSendError(e.message ?? 'Error al enviar')
      }
      setText(caption)
      if (fileToSend) setPendingFile(fileToSend)
    } finally {
      setSending(false)
    }
  }, [agent, windowBlocked, isNoteMode, text, pendingFile, id, addOptimisticMessage, markOptimisticFailed])

  async function handleTakeConversation() {
    if (!confirm('¿Tomar esta conversación? El chat quedará asignado a ti.')) return
    setTaking(true)
    try {
      await api.post(`/api/v1/conversations/${id}/take`, {})
      reload(); onTakeSuccess?.()
    } catch (err) { alert(err instanceof Error ? err.message : 'Error') }
    finally { setTaking(false) }
  }

  async function handleReturnToBot() {
    if (!confirm('¿Devolver este chat al bot? Angela retomará la atención.')) return
    try { await api.post(`/api/v1/conversations/${id}/return-to-bot`, {}); onBack() }
    catch (err) { alert(err instanceof Error ? err.message : 'Error') }
  }

  if (forbidden) {
    return (
      <div className="dash-chat-empty">
        <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🚫</div>
        <p>Este chat no está asignado a ti.</p>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginTop: '1rem' }}>Volver</button>
      </div>
    )
  }

  return (
    <div
      className={`dash-chat${isDragging ? ' dash-chat--dragging' : ''}`}
      onDragOver={canReply && !windowBlocked ? handleDragOver : undefined}
      onDragLeave={canReply && !windowBlocked ? handleDragLeave : undefined}
      onDrop={canReply && !windowBlocked ? handleDrop : undefined}
    >
      <header className="dash-chat-header">
        <button className="dash-back-btn" onClick={onBack} title="Volver">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="dash-avatar dash-avatar--sm" style={{ background: avatarColor(meta?.phoneNumber ?? id) }}>
          {contactInitials(meta?.contactName, meta?.phoneNumber ?? id)}
        </div>
        <div className="dash-chat-header-info">
          <span className="dash-chat-header-name">
            {meta?.contactName ?? meta?.phoneNumber ?? '…'}
            <WhatsAppChannelBadge />
            {isPinned && <span className="dash-pin-icon dash-pin-icon--header" title="Fijado">📌</span>}
            {isArchived && <span className="dash-archived-badge">Archivado</span>}
          </span>
          <span className="dash-chat-header-sub">
            {meta?.contactName ? `${meta.phoneNumber} · ` : ''}
            WhatsApp · {meta?.mode === 'human' ? 'Atención humana' : 'Bot'}
            {meta?.assignedAgentName ? ` · Asesor: ${meta.assignedAgentName}` : ''}
          </span>
          {meta?.labels && meta.labels.length > 0 && (
            <div className="dash-conv-labels" style={{ marginTop: '.2rem' }}>
              {meta.labels.map((l) => (
                <span key={l} className="dash-label-chip" style={{ background: labelColor(l) + '33', color: labelColor(l), borderColor: labelColor(l) + '66' }}>{l}</span>
              ))}
            </div>
          )}
        </div>

        {/* Header action buttons */}
        <div className="dash-header-actions">
          <button
            className={`dash-action-btn${isPinned ? ' dash-action-btn--active' : ''}`}
            title={isPinned ? 'Desfijar' : 'Fijar'}
            onClick={handlePin}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
            </svg>
          </button>
          <button
            className={`dash-action-btn${isArchived ? ' dash-action-btn--warn' : ''}`}
            title={isArchived ? 'Desarchivar' : 'Archivar'}
            onClick={handleArchive}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/>
            </svg>
          </button>
          {isAdminPanel && (
            <button
              className="dash-action-btn"
              title="Reasignar conversación"
              onClick={() => setShowReassignModal(true)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </button>
          )}
        </div>

        {isBotPreview && (
          <button className="dash-take-btn" onClick={handleTakeConversation} disabled={taking}>
            {taking ? '…' : 'Tomar conversación'}
          </button>
        )}
        {canReply && (
          <button className="dash-return-btn" onClick={handleReturnToBot}>
            Devolver al bot
          </button>
        )}
      </header>

      <div
        className="dash-messages"
        ref={messagesRef}
        onScroll={handleMessagesScroll}
        onPaste={canReply && !windowBlocked ? handlePaste : undefined}
      >
        {loading && messages.length === 0 && (
          <div className="dash-chat-empty" style={{ flex: 1 }}><span className="spinner" /></div>
        )}
        {error && <div className="alert alert-error" style={{ margin: '1rem' }}>{error}</div>}

        {/* G7 — date separators */}
        {messages.map((m, i) => {
          const mDate = new Date(m.timestamp)
          const prevDate = i > 0 ? new Date(messages[i - 1]!.timestamp) : null
          const showSep = !prevDate || !sameDay(mDate, prevDate)
          return (
            <Fragment key={m.id}>
              {showSep && <DateSeparator date={mDate} />}
              <MessageBubble message={m} />
            </Fragment>
          )
        })}

        <TypingIndicator label={typingAgent} />
      </div>

      {/* 24h window banner */}
      {canReply && !csWindowOpen && (
        <div className="dash-window-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden>
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Ventana 24h cerrada — el lead debe escribir primero para reabrir la ventana
        </div>
      )}

      {!canReply && isBotPreview && (
        <div className="dash-input-bar" style={{ justifyContent: 'center', color: '#94a3b8', fontSize: '.85rem' }}>
          Revisión del bot — usa «Tomar conversación» para responder
        </div>
      )}

      {canReply && (
        <div className="dash-input-bar">
          {sendError && <p className="dash-send-error">{sendError}</p>}

          {/* Pending file preview */}
          {pendingFile && (
            <div className="dash-file-preview">
              <span className="dash-file-preview-name">
                {filePreviewEmoji(pendingFile)}{pendingFile.name}
              </span>
              <button type="button" className="dash-file-preview-remove" onClick={() => setPendingFile(null)} title="Eliminar">✕</button>
            </div>
          )}

          {/* Note mode toggle bar */}
          <div className="dash-composer-modes">
            <button
              type="button"
              className={`dash-mode-btn${!isNoteMode ? ' dash-mode-btn--active' : ''}`}
              onClick={() => setIsNoteMode(false)}
            >
              Mensaje
            </button>
            <button
              type="button"
              className={`dash-mode-btn${isNoteMode ? ' dash-mode-btn--active dash-mode-btn--note' : ''}`}
              onClick={() => { setIsNoteMode(true); setPendingFile(null) }}
            >
              📝 Nota interna
            </button>
          </div>

          {/* Quick replies popover */}
          {showQuickReplies && (
            <QuickRepliesPopover
              anchorRef={qrBtnRef}
              onSelect={(body) => setText(body)}
              onClose={() => setShowQuickReplies(false)}
            />
          )}

          <form onSubmit={sendMessage}>
            <div className="dash-input-row">
              {/* Hidden inputs: one for documents, one for photos/videos */}
              <input ref={fileInputRef} type="file" accept={ACCEPT_DOCS} style={{ display: 'none' }} onChange={handleFileChange} />
              <input ref={fileMediaRef} type="file" accept={ACCEPT_MEDIA} style={{ display: 'none' }} onChange={handleFileChange} />

              {!isNoteMode && (
                <div className="dash-attach-wrap">
                  {showAttachMenu && (
                    <div className="dash-attach-menu">
                      <button type="button" className="dash-attach-menu-item" onClick={handlePickDocs}>
                        <span className="dash-attach-menu-icon dash-attach-menu-icon--doc">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </span>
                        <span>Documento</span>
                      </button>
                      <button type="button" className="dash-attach-menu-item" onClick={handlePickMedia}>
                        <span className="dash-attach-menu-icon dash-attach-menu-icon--media">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </span>
                        <span>Foto o video</span>
                      </button>
                    </div>
                  )}
                  <button
                    ref={attachBtnRef}
                    type="button"
                    className={`dash-attach-btn${showAttachMenu ? ' dash-attach-btn--active' : ''}`}
                    onClick={handleAttachClick}
                    disabled={sending || windowBlocked}
                    title="Adjuntar archivo"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Quick replies button */}
              {!isNoteMode && (
                <button
                  ref={qrBtnRef}
                  type="button"
                  className={`dash-attach-btn${showQuickReplies ? ' dash-attach-btn--active' : ''}`}
                  onClick={() => setShowQuickReplies((v) => !v)}
                  disabled={sending || windowBlocked}
                  title="Respuestas rápidas"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M7 14H5c0 2.76 2.24 5 5 5s5-2.24 5-5h-2c0 1.65-1.35 3-3 3s-3-1.35-3-3zm4-8H9V5H7v1H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-2V5h-2v1h-2zm5 2v6H5V8h14z"/>
                  </svg>
                </button>
              )}

              <input
                type="text"
                className={`dash-input${isNoteMode ? ' dash-input--note' : ''}`}
                placeholder={
                  isNoteMode
                    ? 'Escribe una nota interna (solo visible para el equipo)…'
                    : pendingFile
                      ? 'Escribe un caption (opcional)…'
                      : 'Escribe un mensaje…'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={sending || (windowBlocked && !isNoteMode)}
                autoFocus
              />
              <button
                type="submit"
                className={`dash-send-btn${isNoteMode ? ' dash-send-btn--note' : ''}`}
                disabled={sending || (windowBlocked && !isNoteMode) || (!text.trim() && !pendingFile)}
                title="Enviar"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {readOnly && !isBotPreview && (
        <div className="dash-input-bar" style={{ justifyContent: 'center', color: '#94a3b8', fontSize: '.85rem' }}>
          Vista de solo lectura (administrador)
        </div>
      )}

      {/* Reassign modal */}
      {showReassignModal && (
        <ReassignModal
          conversationId={id}
          onClose={() => setShowReassignModal(false)}
          onSuccess={() => {
            setShowReassignModal(false)
            reload()
            onMutated?.()
          }}
        />
      )}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { agent, logout, isAdmin } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [agentFilter, setAgentFilter] = useState<AgentInboxFilter>('own')
  const [listFilter, setListFilter] = useState<InboxListFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const searchQuery = useDebounced(searchInput, 300)
  const [labelInput, setLabelInput] = useState('')
  const labelFilter = useDebounced(labelInput, 400)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [adminFilter, setAdminFilter] = useState<AdminInboxFilter>('all')

  const { conversations, total, loading, error, reload: reloadInbox } = useInbox({
    isAdmin,
    agentFilter: isAdmin ? undefined : agentFilter,
    listFilter: isAdmin ? 'all' : listFilter,
    searchQuery,
    label: labelFilter,
    includeArchived: isAdmin ? includeArchived : false,
    activeConversationId: id,
  })

  const filteredConversations = useMemo(() => {
    let list = conversations
    if (isAdmin && adminFilter !== 'all') {
      list = list.filter((c) => matchesAdminFilter(c, adminFilter))
    }
    if (searchQuery.trim()) {
      list = list.filter((c) => matchesSearch(c, searchQuery))
    }
    if (labelFilter.trim()) {
      list = list.filter((c) => matchesLabelFilter(c, labelFilter))
    }
    return list
  }, [conversations, isAdmin, adminFilter, searchQuery, labelFilter])

  const hasActiveFilters = Boolean(
    searchQuery.trim() || labelFilter.trim() || (isAdmin && adminFilter !== 'all'),
  )
  const displayTotal = hasActiveFilters ? filteredConversations.length : total
  const hasChatOpen = Boolean(id)

  useMessageNotifications({ activeConversationId: id, readOnly: isAdmin, agentId: agent?.id })

  function handleTakeSuccess() { setAgentFilter('own'); reloadInbox() }
  function handleAgentFilterChange(filter: AgentInboxFilter) {
    setAgentFilter(filter); setListFilter('all')
    if (id) navigate('/')
  }
  function handleListFilterChange(filter: InboxListFilter) {
    setListFilter(filter)
    if (id) navigate('/')
  }
  function openChat(conv: ConversationSummary) { navigate(`/chat/${conv.id}`) }
  function closeChat() { navigate('/') }

  return (
    <div className="dash-layout">
      {/* ── Sidebar ── */}
      <aside className={`dash-sidebar${hasChatOpen ? ' dash-sidebar--hidden-mobile' : ''}`}>
        <header className="dash-sidebar-header">
          <div className="dash-sidebar-header-row">
            <div className="dash-sidebar-title-block">
              <div className="dash-sidebar-title">
                <span className="dash-sidebar-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                  </svg>
                </span>
                Chats
                {displayTotal > 0 && <span className="dash-badge dash-badge--header">{displayTotal}</span>}
              </div>
              <span className="dash-sidebar-subtitle">WhatsApp Business</span>
            </div>
            <div className="dash-sidebar-actions">
              <SoundToggle />
              <button className="dash-logout-btn" onClick={logout} title="Cerrar sesión">
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="dash-sidebar-user">
            <span className="dash-agent-name">
              {agent?.name}
              {isAdmin && <span className="dash-agent-role"> · Admin</span>}
            </span>
            <ConnectionStatus />
          </div>
        </header>

        <ConnectionBanner />

        {/* ── Admin filters ── */}
        {isAdmin ? (
          <>
            <div className="dash-filters">
              {(['all', 'bot', 'assigned'] as AdminInboxFilter[]).map((f) => (
                <button key={f} type="button"
                  className={`dash-filter-btn${adminFilter === f ? ' dash-filter-btn--active' : ''}`}
                  onClick={() => setAdminFilter(f)}
                >
                  {f === 'all' ? 'Todos' : f === 'bot' ? 'Bot' : 'Asignados'}
                </button>
              ))}
            </div>
            {/* C15 archived toggle (admin) */}
            <div className="dash-archived-row">
              <label className="dash-archived-label">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                />
                Mostrar archivados
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="dash-filters">
              <button type="button"
                className={`dash-filter-btn${agentFilter === 'own' ? ' dash-filter-btn--active' : ''}`}
                onClick={() => handleAgentFilterChange('own')}
              >Propios</button>
              <button type="button"
                className={`dash-filter-btn${agentFilter === 'bot' ? ' dash-filter-btn--active' : ''}`}
                onClick={() => handleAgentFilterChange('bot')}
              >Bot</button>
            </div>
            {agentFilter === 'own' && (
              <div className="dash-filters dash-filters--secondary">
                {(['all', 'unread', 'unanswered'] as InboxListFilter[]).map((f) => (
                  <button key={f} type="button"
                    className={`dash-filter-btn${listFilter === f ? ' dash-filter-btn--active' : ''}`}
                    onClick={() => handleListFilterChange(f)}
                  >
                    {f === 'all' ? 'Todos' : f === 'unread' ? 'No leídos' : 'Sin responder'}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* C12 + C13 — búsqueda y etiqueta */}
        <div className="dash-filter-bar">
          <div className="dash-filter-field">
            <span className="dash-filter-label">Buscar contacto</span>
            <div className="dash-search dash-search--compact">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="dash-search-icon" aria-hidden>
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="search"
                className="dash-search-input"
                placeholder="Nombre o teléfono…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
              {searchInput && (
                <button type="button" className="dash-search-clear" onClick={() => setSearchInput('')} title="Limpiar">✕</button>
              )}
            </div>
          </div>
          <div className="dash-filter-field">
            <span className="dash-filter-label">Etiqueta</span>
            <div className="dash-search dash-search--compact">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" className="dash-search-icon" aria-hidden>
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 013 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
              <input
                type="search"
                className="dash-search-input dash-search-input--label"
                placeholder="ej. interesado…"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value.toLowerCase())}
                autoComplete="off"
              />
              {labelInput && (
                <button type="button" className="dash-search-clear" onClick={() => setLabelInput('')} title="Limpiar">✕</button>
              )}
            </div>
          </div>
        </div>

        <ul className="dash-conv-list">
          {loading && filteredConversations.length === 0 && (
            <li className="dash-conv-empty"><span className="spinner" /></li>
          )}
          {error && (
            <li className="dash-conv-empty">
              <span style={{ color: '#f87171', fontSize: '.85rem' }}>{error}</span>
            </li>
          )}
          {!loading && !error && filteredConversations.length === 0 && (
            <li className="dash-conv-empty">
              <span style={{ fontSize: '2rem' }}>📭</span>
              <span>
                {searchQuery || labelFilter
                  ? 'Sin resultados para tu búsqueda'
                  : listFilter === 'unread'
                    ? 'Sin chats no leídos'
                    : listFilter === 'unanswered'
                      ? 'Sin chats sin responder'
                      : isAdmin && adminFilter === 'bot'
                        ? 'Sin chats en bot'
                        : isAdmin && adminFilter === 'assigned'
                          ? 'Sin chats asignados'
                          : isAdmin
                            ? 'Sin chats este mes'
                            : agentFilter === 'bot'
                              ? 'Sin chats del bot este mes'
                              : 'Sin chats asignados a ti. Prueba la pestaña Bot →'}
              </span>
            </li>
          )}
          {filteredConversations.map((c) => (
            <ConvItem key={c.id} conv={c} active={c.id === id} onClick={() => openChat(c)} showAssignedAgent={isAdmin} />
          ))}
        </ul>
      </aside>

      {/* ── Chat area ── */}
      <main className={`dash-main${hasChatOpen ? '' : ' dash-main--hidden-mobile'}`}>
        {id ? (
          <ChatPanel
            id={id}
            onBack={closeChat}
            readOnly={isAdmin}
            botPreview={!isAdmin && agentFilter === 'bot'}
            onTakeSuccess={handleTakeSuccess}
            onMutated={reloadInbox}
            isAdminPanel={isAdmin}
          />
        ) : (
          <div className="dash-chat-empty">
            <div className="dash-empty-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" opacity=".3"/>
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
              </svg>
            </div>
            <p>Selecciona un chat para comenzar</p>
          </div>
        )}
      </main>
    </div>
  )
}
