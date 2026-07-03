import type { ConversationSummary } from '../hooks/useInbox'

interface Props {
  conversation: ConversationSummary
  onClick: () => void
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday)
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

export default function ConversationCard({ conversation: c, onClick }: Props) {
  const hasUnread = c.unreadCountAgent > 0
  const lastActivity = c.lastUserMessageAt ?? c.updatedAt

  return (
    <li className={`conv-card${hasUnread ? ' conv-card--unread' : ''}`} onClick={onClick}>
      <div className="conv-avatar">
        <span>👤</span>
      </div>
      <div className="conv-body">
        <div className="conv-row">
          <span className="conv-phone">{c.phoneNumber}</span>
          <span className="conv-time">{formatTime(lastActivity)}</span>
        </div>
        <div className="conv-row">
          <span className="conv-preview">
            {c.mode === 'human' ? 'En atención humana' : 'En bot'}
          </span>
          {hasUnread && <span className="conv-badge">{c.unreadCountAgent}</span>}
        </div>
      </div>
    </li>
  )
}
