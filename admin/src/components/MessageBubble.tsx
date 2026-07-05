import type { ChatMessage } from '../hooks/useChatMessages'
import MessageStatusIcon from './MessageStatusIcon'

interface Props {
  message: ChatMessage
}

const ROLE_LABEL: Partial<Record<ChatMessage['role'], string>> = {
  assistant: 'Angela',
  system: 'Sistema',
}

export default function MessageBubble({ message: m }: Props) {
  const isOutbound = m.role === 'agent' || m.role === 'assistant'
  const time = new Date(m.timestamp).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const senderLabel = ROLE_LABEL[m.role]

  return (
    <div className={`dash-bubble-row${isOutbound ? ' dash-bubble-row--out' : ''}`}>
      <div className={`dash-bubble dash-bubble--${m.role}`}>
        {senderLabel && (
          <span className="dash-bubble-sender">{senderLabel}</span>
        )}
        <p className="dash-bubble-text">{m.content}</p>
        <div className="dash-bubble-footer">
          <span className="dash-bubble-time">{time}</span>
          {isOutbound && <MessageStatusIcon status={m.status} />}
        </div>
      </div>
    </div>
  )
}
