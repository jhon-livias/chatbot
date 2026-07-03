import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useInbox } from '../hooks/useInbox'
import ConversationCard from '../components/ConversationCard'

export default function InboxPage() {
  const { agent, logout } = useAuth()
  const navigate = useNavigate()
  const { conversations, total, loading, error } = useInbox()

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-icon">💬</span>
          <span className="topbar-title">Bandeja de entrada</span>
          {total > 0 && <span className="badge">{total}</span>}
        </div>
        <div className="topbar-right">
          <span className="topbar-agent">{agent?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="inbox-main">
        {loading && conversations.length === 0 && (
          <div className="state-empty">
            <span className="spinner" />
            <p>Cargando chats…</p>
          </div>
        )}

        {error && (
          <div className="alert alert-error" style={{ margin: '1rem' }}>
            {error}
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="state-empty">
            <span style={{ fontSize: '2.5rem' }}>📭</span>
            <p>No tienes chats asignados en este momento.</p>
          </div>
        )}

        <ul className="conversation-list">
          {conversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              onClick={() => navigate(`/chat/${conv.id}`)}
            />
          ))}
        </ul>
      </main>
    </div>
  )
}
