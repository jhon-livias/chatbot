import type { ChatMessage } from '../hooks/useChatMessages'

interface Props {
  message: ChatMessage
}

const ROLE_LABEL: Record<ChatMessage['role'], string> = {
  user: 'Lead',
  assistant: 'Angela (bot)',
  agent: 'Tú',
  system: 'Sistema',
}

export default function MessageBubble({ message: m }: Props) {
  const isOutbound = m.role === 'agent' || m.role === 'assistant'
  const time = new Date(m.timestamp).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={`bubble-row${isOutbound ? ' bubble-row--out' : ''}`}>
      <div className={`bubble bubble--${m.role}`}>
        <span className="bubble-sender">{ROLE_LABEL[m.role]}</span>
        <p className="bubble-text">{m.content}</p>
        <span className="bubble-time">{time}</span>
      </div>
    </div>
  )
}
