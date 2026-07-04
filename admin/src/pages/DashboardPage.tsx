import { useState, useEffect, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useInbox, type ConversationSummary } from '../hooks/useInbox'
import { useChatMessages } from '../hooks/useChatMessages'
import { api } from '../api/client'

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

// ─── Sidebar item ────────────────────────────────────────────────────────────

function ConvItem({
  conv,
  active,
  onClick,
}: {
  conv: ConversationSummary
  active: boolean
  onClick: () => void
}) {
  const hasUnread = conv.unreadCountAgent > 0
  const lastActivity = conv.lastUserMessageAt ?? conv.updatedAt

  return (
    <li
      className={`dash-conv-item${active ? ' dash-conv-item--active' : ''}${hasUnread ? ' dash-conv-item--unread' : ''}`}
      onClick={onClick}
    >
      <div
        className="dash-avatar"
        style={{ background: avatarColor(conv.phoneNumber) }}
      >
        {contactInitials(conv.contactName, conv.phoneNumber)}
        <span className="dash-avatar-wa" title="WhatsApp">
          <svg viewBox="0 0 20 20" fill="currentColor" width="10" height="10">
            <path d="M10 0C4.477 0 0 4.477 0 10c0 1.763.463 3.414 1.27 4.847L0 20l5.285-1.248A9.957 9.957 0 0010 20c5.523 0 10-4.477 10-10S15.523 0 10 0zm0 18.182a8.182 8.182 0 01-4.17-1.14l-.299-.178-3.136.74.788-3.055-.196-.314A8.182 8.182 0 1110 18.182zm4.49-6.128c-.246-.123-1.456-.718-1.681-.8-.225-.081-.388-.122-.552.123-.163.246-.633.8-.776.965-.143.163-.286.184-.532.061-.246-.123-1.04-.383-1.98-1.22-.732-.652-1.226-1.457-1.37-1.703-.143-.246-.015-.379.108-.502.11-.11.245-.286.368-.43.122-.143.163-.245.245-.408.082-.163.041-.307-.02-.43-.061-.123-.552-1.33-.756-1.822-.2-.48-.403-.414-.553-.422l-.47-.008c-.164 0-.43.061-.654.307-.225.245-.858.838-.858 2.044s.878 2.37 1.001 2.534c.122.163 1.727 2.637 4.185 3.698.585.253 1.04.404 1.395.517.586.187 1.12.16 1.542.097.47-.07 1.456-.595 1.66-1.17.205-.573.205-1.065.143-1.168-.061-.102-.224-.163-.47-.286z" />
          </svg>
        </span>
      </div>
      <div className="dash-conv-body">
        <div className="dash-conv-row">
          <span className="dash-conv-name">
            {conv.contactName ?? 'Contacto'}
          </span>
          <span className="dash-conv-time">{formatTime(lastActivity)}</span>
        </div>
        <div className="dash-conv-row">
          <span className="dash-conv-phone">{conv.phoneNumber}</span>
        </div>
        <div className="dash-conv-row">
          <span className="dash-conv-preview">
            {conv.mode === 'human' ? 'En atención' : 'En bot'}
          </span>
          {hasUnread && (
            <span className="dash-badge">{conv.unreadCountAgent}</span>
          )}
        </div>
      </div>
    </li>
  )
}

// ─── Chat panel ──────────────────────────────────────────────────────────────

function ChatPanel({ id, onBack }: { id: string; onBack: () => void }) {
  const { messages, meta, loading, error, forbidden, reload } = useChatMessages(id)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    api.post(`/api/v1/conversations/${id}/read`, {}).catch(() => void 0)
  }, [id])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSendError('')
    setSending(true)
    try {
      await api.post(`/api/v1/conversations/${id}/messages`, { content: text.trim() })
      setText('')
      reload()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSending(false)
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
    <div className="dash-chat">
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
          </span>
          <span className="dash-chat-header-sub">
            {meta?.contactName ? `${meta.phoneNumber} · ` : ''}
            WhatsApp · {meta?.mode === 'human' ? 'Atención humana' : 'Bot'}
          </span>
        </div>
        <button className="dash-return-btn" onClick={handleReturnToBot}>
          Devolver al bot
        </button>
      </header>

      <div className="dash-messages">
        {loading && messages.length === 0 && (
          <div className="dash-chat-empty" style={{ flex: 1 }}>
            <span className="spinner" />
          </div>
        )}
        {error && (
          <div className="alert alert-error" style={{ margin: '1rem' }}>{error}</div>
        )}
        {messages.map((m) => {
          const isOut = m.role === 'agent' || m.role === 'assistant'
          const time = new Date(m.timestamp).toLocaleTimeString('es-PE', {
            hour: '2-digit', minute: '2-digit',
          })
          const LABEL: Record<string, string> = {
            user: '', assistant: 'Angela', agent: '', system: 'Sistema',
          }
          return (
            <div key={m.id} className={`dash-bubble-row${isOut ? ' dash-bubble-row--out' : ''}`}>
              <div className={`dash-bubble dash-bubble--${m.role}`}>
                {LABEL[m.role] && (
                  <span className="dash-bubble-sender">{LABEL[m.role]}</span>
                )}
                <p className="dash-bubble-text">{m.content}</p>
                <span className="dash-bubble-time">{time}</span>
              </div>
            </div>
          )
        })}
      </div>

      <form className="dash-input-bar" onSubmit={handleSend}>
        {sendError && <p className="dash-send-error">{sendError}</p>}
        <div className="dash-input-row">
          <input
            type="text"
            className="dash-input"
            placeholder="Escribe un mensaje…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
            autoFocus
          />
          <button
            type="submit"
            className="dash-send-btn"
            disabled={sending || !text.trim()}
            title="Enviar"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { agent, logout } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { conversations, total, loading, error } = useInbox()

  const hasChatOpen = Boolean(id)

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
          <div className="dash-sidebar-title">
            <span className="dash-sidebar-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </span>
            Chats
            {total > 0 && <span className="dash-badge dash-badge--header">{total}</span>}
          </div>
          <div className="dash-sidebar-agent">
            <span className="dash-agent-name">{agent?.name}</span>
            <button className="dash-logout-btn" onClick={logout} title="Cerrar sesión">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
            </button>
          </div>
        </header>

        <ul className="dash-conv-list">
          {loading && conversations.length === 0 && (
            <li className="dash-conv-empty">
              <span className="spinner" />
            </li>
          )}
          {error && (
            <li className="dash-conv-empty">
              <span style={{ color: '#f87171', fontSize: '.85rem' }}>{error}</span>
            </li>
          )}
          {!loading && !error && conversations.length === 0 && (
            <li className="dash-conv-empty">
              <span style={{ fontSize: '2rem' }}>📭</span>
              <span>Sin chats asignados</span>
            </li>
          )}
          {conversations.map((c) => (
            <ConvItem
              key={c.id}
              conv={c}
              active={c.id === id}
              onClick={() => openChat(c)}
            />
          ))}
        </ul>
      </aside>

      {/* ── Chat area ── */}
      <main className={`dash-main${hasChatOpen ? '' : ' dash-main--hidden-mobile'}`}>
        {id ? (
          <ChatPanel id={id} onBack={closeChat} />
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
