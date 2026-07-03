import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useChatMessages } from '../hooks/useChatMessages'
import MessageBubble from '../components/MessageBubble'

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { messages, meta, loading, error, forbidden, reload } = useChatMessages(id ?? '')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (id) {
      api.post(`/api/v1/conversations/${id}/read`, {}).catch(() => void 0)
    }
  }, [id])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || !id) return
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
    if (!id) return
    if (!confirm('¿Devolver este chat al bot? Angela retomará la atención.')) return
    try {
      await api.post(`/api/v1/conversations/${id}/return-to-bot`, {})
      navigate('/')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  if (forbidden) {
    return (
      <div className="page">
        <div className="state-empty">
          <span style={{ fontSize: '2.5rem' }}>🚫</span>
          <p>Este chat no está asignado a ti.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Volver al inbox
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page chat-page">
      <header className="topbar">
        <div className="topbar-left">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Volver
          </button>
          <div>
            <span className="topbar-title">{meta?.phoneNumber ?? '…'}</span>
            <span className="topbar-subtitle">WhatsApp</span>
          </div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-ghost btn-sm" onClick={handleReturnToBot}>
            Devolver al bot
          </button>
        </div>
      </header>

      <div className="chat-messages">
        {loading && messages.length === 0 && (
          <div className="state-empty">
            <span className="spinner" />
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ margin: '1rem' }}>
            {error}
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSend}>
        {sendError && <div className="send-error">{sendError}</div>}
        <input
          type="text"
          placeholder="Escribe un mensaje…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>
          {sending ? '…' : 'Enviar'}
        </button>
      </form>
    </div>
  )
}
