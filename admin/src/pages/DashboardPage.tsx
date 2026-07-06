import {
  useState, useEffect, useMemo, useRef,
  useCallback, type FormEvent, type DragEvent, type ClipboardEvent,
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

export type AdminInboxFilter = 'all' | 'bot' | 'assigned'

function matchesAdminFilter(conv: ConversationSummary, filter: AdminInboxFilter): boolean {
  if (filter === 'bot') return conv.mode === 'bot'
  if (filter === 'assigned') return conv.mode === 'human' && conv.assignedAgentId !== null
  return true
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

function isAllowedFile(file: File): boolean {
  return ALLOWED_MIME.has(file.type)
}

// ─── Sidebar item ────────────────────────────────────────────────────────────

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

  return (
    <li
      className={`dash-conv-item${active ? ' dash-conv-item--active' : ''}${hasUnread ? ' dash-conv-item--unread' : ''}`}
      onClick={onClick}
    >
      <div className="dash-avatar" style={{ background: avatarColor(conv.phoneNumber) }}>
        {contactInitials(conv.contactName, conv.phoneNumber)}
      </div>
      <div className="dash-conv-body">
        <div className="dash-conv-row dash-conv-row--top">
          <div className="dash-conv-name-row">
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
      </div>
    </li>
  )
}

// ─── Chat panel ──────────────────────────────────────────────────────────────

function ChatPanel({
  id, onBack, readOnly, botPreview, onTakeSuccess,
}: {
  id: string
  onBack: () => void
  readOnly?: boolean
  botPreview?: boolean
  onTakeSuccess?: () => void
}) {
  const { agent } = useAuth()
  const {
    messages, meta, loading, error, forbidden, reload,
    addOptimisticMessage, markOptimisticFailed,
  } = useChatMessages(id)
  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [taking, setTaking] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBotPreview = botPreview === true && meta?.mode === 'bot'
  const canReply = !readOnly && !isBotPreview
  const csWindowOpen = meta?.csWindowOpen ?? true
  const windowBlocked = canReply && !csWindowOpen

  useTypingEmitter(id, text, canReply)
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

  // ─── Drag & drop ───────────────────────────────────────────────────────────

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && isAllowedFile(file)) {
      setPendingFile(file)
      setSendError('')
    } else if (file) {
      setSendError('Tipo de archivo no permitido. Usa imagen (jpg/png/webp) o PDF.')
    }
  }

  // ─── Paste image ───────────────────────────────────────────────────────────

  function handlePaste(e: ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.kind === 'file' && i.type.startsWith('image/'))
    if (!item) return
    const file = item.getAsFile()
    if (file && isAllowedFile(file)) {
      e.preventDefault()
      setPendingFile(file)
      setSendError('')
    }
  }

  // ─── File input click ──────────────────────────────────────────────────────

  function handleAttachClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && isAllowedFile(file)) {
      setPendingFile(file)
      setSendError('')
    } else if (file) {
      setSendError('Tipo de archivo no permitido.')
    }
    e.target.value = ''
  }

  function clearPendingFile() {
    setPendingFile(null)
  }

  // ─── Send ──────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!agent || windowBlocked) return
    const caption = text.trim()
    if (!pendingFile && !caption) return
    setSendError('')

    const optimisticId = addOptimisticMessage(
      pendingFile ? `[${pendingFile.type.startsWith('image/') ? 'imagen' : 'documento'}] ${caption}` : caption,
      agent.id,
    )
    setText('')
    const fileToSend = pendingFile
    setPendingFile(null)
    setSending(true)
    nearBottomRef.current = true

    try {
      if (fileToSend) {
        const form = new FormData()
        if (caption) form.append('content', caption)
        form.append('file', fileToSend, fileToSend.name)
        await api.postFormData(`/api/v1/conversations/${id}/messages`, form)
      } else {
        await api.post(`/api/v1/conversations/${id}/messages`, { content: caption })
      }
    } catch (err) {
      markOptimisticFailed(optimisticId)
      setSendError(err instanceof Error ? err.message : 'Error al enviar')
      setText(caption)
      if (fileToSend) setPendingFile(fileToSend)
    } finally {
      setSending(false)
    }
  }, [agent, windowBlocked, text, pendingFile, id, addOptimisticMessage, markOptimisticFailed])

  async function handleTakeConversation() {
    if (!confirm('¿Tomar esta conversación? El chat quedará asignado a ti.')) return
    setTaking(true)
    try {
      await api.post(`/api/v1/conversations/${id}/take`, {})
      reload()
      onTakeSuccess?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    } finally {
      setTaking(false)
    }
  }

  async function handleReturnToBot() {
    if (!confirm('¿Devolver este chat al bot? Angela retomará la atención.')) return
    try {
      await api.post(`/api/v1/conversations/${id}/return-to-bot`, {})
      onBack()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  if (forbidden) {
    return (
      <div className="dash-chat-empty">
        <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>🚫</div>
        <p>Este chat no está asignado a ti.</p>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginTop: '1rem' }}>
          Volver
        </button>
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
        <div
          className="dash-avatar dash-avatar--sm"
          style={{ background: avatarColor(meta?.phoneNumber ?? id) }}
        >
          {contactInitials(meta?.contactName, meta?.phoneNumber ?? id)}
        </div>
        <div className="dash-chat-header-info">
          <span className="dash-chat-header-name">
            {meta?.contactName ?? meta?.phoneNumber ?? '…'}
            <WhatsAppChannelBadge />
          </span>
          <span className="dash-chat-header-sub">
            {meta?.contactName ? `${meta.phoneNumber} · ` : ''}
            WhatsApp · {meta?.mode === 'human' ? 'Atención humana' : 'Bot'}
            {meta?.assignedAgentName ? ` · Asesor: ${meta.assignedAgentName}` : ''}
          </span>
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

      <div className="dash-messages" ref={messagesRef} onScroll={handleMessagesScroll} onPaste={canReply && !windowBlocked ? handlePaste : undefined}>
        {loading && messages.length === 0 && (
          <div className="dash-chat-empty" style={{ flex: 1 }}><span className="spinner" /></div>
        )}
        {error && <div className="alert alert-error" style={{ margin: '1rem' }}>{error}</div>}
        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
        <TypingIndicator label={typingAgent} />
      </div>

      {/* ── E10: ventana 24h banner ── */}
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
        <form className="dash-input-bar" onSubmit={sendMessage}>
          {sendError && <p className="dash-send-error">{sendError}</p>}

          {/* Pending file preview */}
          {pendingFile && (
            <div className="dash-file-preview">
              <span className="dash-file-preview-name">
                {pendingFile.type.startsWith('image/') ? '🖼 ' : '📄 '}
                {pendingFile.name}
              </span>
              <button type="button" className="dash-file-preview-remove" onClick={clearPendingFile} title="Eliminar">✕</button>
            </div>
          )}

          <div className="dash-input-row">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {/* Attach button */}
            <button
              type="button"
              className="dash-attach-btn"
              onClick={handleAttachClick}
              disabled={sending || windowBlocked}
              title="Adjuntar imagen o PDF"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              type="text"
              className="dash-input"
              placeholder={pendingFile ? 'Escribe un caption (opcional)…' : 'Escribe un mensaje…'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={sending || windowBlocked}
              autoFocus
            />
            <button
              type="submit"
              className="dash-send-btn"
              disabled={sending || windowBlocked || (!text.trim() && !pendingFile)}
              title="Enviar"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </form>
      )}
      {readOnly && !isBotPreview && (
        <div className="dash-input-bar" style={{ justifyContent: 'center', color: '#94a3b8', fontSize: '.85rem' }}>
          Vista de solo lectura (administrador)
        </div>
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
  const [adminFilter, setAdminFilter] = useState<AdminInboxFilter>('all')

  const { conversations, total, loading, error, reload: reloadInbox } = useInbox({
    isAdmin,
    agentFilter: isAdmin ? undefined : agentFilter,
    listFilter: isAdmin ? 'all' : listFilter,
    searchQuery,
    activeConversationId: id,
  })

  const filteredConversations = useMemo(() => {
    if (!isAdmin || adminFilter === 'all') return conversations
    return conversations.filter((c) => matchesAdminFilter(c, adminFilter))
  }, [conversations, isAdmin, adminFilter])

  const displayTotal = isAdmin && adminFilter !== 'all' ? filteredConversations.length : total
  const hasChatOpen = Boolean(id)

  useMessageNotifications({ activeConversationId: id, readOnly: isAdmin, agentId: agent?.id })

  function handleTakeSuccess() {
    setAgentFilter('own')
    reloadInbox()
  }

  function handleAgentFilterChange(filter: AgentInboxFilter) {
    setAgentFilter(filter)
    setListFilter('all')
    if (id) navigate('/')
  }

  function handleListFilterChange(filter: InboxListFilter) {
    setListFilter(filter)
    if (id) navigate('/')
  }

  function openChat(conv: ConversationSummary) {
    navigate(`/chat/${conv.id}`)
  }

  function closeChat() {
    navigate('/')
  }

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
                {displayTotal > 0 && (
                  <span className="dash-badge dash-badge--header">{displayTotal}</span>
                )}
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
          <div className="dash-filters">
            {(['all', 'bot', 'assigned'] as AdminInboxFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`dash-filter-btn${adminFilter === f ? ' dash-filter-btn--active' : ''}`}
                onClick={() => setAdminFilter(f)}
              >
                {f === 'all' ? 'Todos' : f === 'bot' ? 'Bot' : 'Asignados'}
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Agent scope filters */}
            <div className="dash-filters">
              <button
                type="button"
                className={`dash-filter-btn${agentFilter === 'own' ? ' dash-filter-btn--active' : ''}`}
                onClick={() => handleAgentFilterChange('own')}
              >
                Propios
              </button>
              <button
                type="button"
                className={`dash-filter-btn${agentFilter === 'bot' ? ' dash-filter-btn--active' : ''}`}
                onClick={() => handleAgentFilterChange('bot')}
              >
                Bot
              </button>
            </div>
            {/* C6 C7 list filters (only for own) */}
            {agentFilter === 'own' && (
              <div className="dash-filters dash-filters--secondary">
                {(['all', 'unread', 'unanswered'] as InboxListFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
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

        {/* C12 Search */}
        <div className="dash-search">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="dash-search-icon" aria-hidden>
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            className="dash-search-input"
            placeholder="Buscar por nombre o teléfono…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button type="button" className="dash-search-clear" onClick={() => setSearchInput('')} title="Limpiar">✕</button>
          )}
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
                {searchQuery
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
                              : 'Sin chats asignados'}
              </span>
            </li>
          )}
          {filteredConversations.map((c) => (
            <ConvItem
              key={c.id}
              conv={c}
              active={c.id === id}
              onClick={() => openChat(c)}
              showAssignedAgent={isAdmin}
            />
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
