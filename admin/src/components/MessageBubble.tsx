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
      <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="dash-bubble-doc">
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
  const isInternal = m.role === 'internal'
  const isOutbound = m.role === 'agent' || m.role === 'assistant'
  const time = new Date(m.timestamp).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const senderLabel = ROLE_LABEL[m.role]
  const hasMedia = (m.contentType === 'image' || m.contentType === 'document') && m.mediaUrl
  const showText = !hasMedia || !!m.content

  if (isInternal) {
    return (
      <div className="dash-bubble-row dash-bubble-row--note">
        <div className="dash-bubble dash-bubble--internal">
          <span className="dash-bubble-note-label">
            <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" style={{ flexShrink: 0 }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            Nota interna
          </span>
          <p className="dash-bubble-text">{m.content}</p>
          <div className="dash-bubble-footer">
            <span className="dash-bubble-time dash-bubble-time--note">{time}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`dash-bubble-row${isOutbound ? ' dash-bubble-row--out' : ''}`}>
      <div className={`dash-bubble dash-bubble--${m.role}`}>
        {senderLabel && <span className="dash-bubble-sender">{senderLabel}</span>}
        {hasMedia && <MediaContent message={m} />}
        {showText && <p className="dash-bubble-text">{m.content}</p>}
        <div className="dash-bubble-footer">
          <span className="dash-bubble-time">{time}</span>
          {isOutbound && <MessageStatusIcon status={m.status} />}
        </div>
      </div>
    </div>
  )
}
