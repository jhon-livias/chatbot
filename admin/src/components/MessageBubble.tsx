import type { ChatMessage } from '../hooks/useChatMessages'
import MessageStatusIcon from './MessageStatusIcon'

interface Props {
  message: ChatMessage
}

const ROLE_LABEL: Partial<Record<ChatMessage['role'], string>> = {
  assistant: 'Angela',
  system: 'Sistema',
}

function MediaContent({ message: m }: { message: ChatMessage }) {
  const isImage = m.contentType === 'image'
  const isDoc = m.contentType === 'document'

  if (isImage && m.mediaUrl) {
    return (
      <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="dash-bubble-media-link">
        <img
          src={m.mediaUrl}
          alt={m.caption ?? m.fileName ?? 'imagen'}
          className="dash-bubble-img"
          loading="lazy"
        />
        {m.caption && <span className="dash-bubble-caption">{m.caption}</span>}
      </a>
    )
  }

  if (isDoc && m.mediaUrl) {
    return (
      <a
        href={m.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="dash-bubble-doc"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
        </svg>
        <span className="dash-bubble-doc-name">{m.fileName ?? m.caption ?? 'Documento'}</span>
      </a>
    )
  }

  return null
}

export default function MessageBubble({ message: m }: Props) {
  const isOutbound = m.role === 'agent' || m.role === 'assistant'
  const time = new Date(m.timestamp).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const senderLabel = ROLE_LABEL[m.role]
  const hasMedia = (m.contentType === 'image' || m.contentType === 'document') && m.mediaUrl
  const showText = !hasMedia || !!m.content

  return (
    <div className={`dash-bubble-row${isOutbound ? ' dash-bubble-row--out' : ''}`}>
      <div className={`dash-bubble dash-bubble--${m.role}`}>
        {senderLabel && (
          <span className="dash-bubble-sender">{senderLabel}</span>
        )}
        {hasMedia && <MediaContent message={m} />}
        {showText && (
          <p className="dash-bubble-text">{m.content}</p>
        )}
        <div className="dash-bubble-footer">
          <span className="dash-bubble-time">{time}</span>
          {isOutbound && <MessageStatusIcon status={m.status} />}
        </div>
      </div>
    </div>
  )
}
