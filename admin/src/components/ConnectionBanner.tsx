import { useEffect, useState } from 'react'
import { useRealtime } from '../context/RealtimeContext'

function formatAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 10) return 'ahora'
  if (secs < 60) return `hace ${secs}s`
  const mins = Math.floor(secs / 60)
  return `hace ${mins} min`
}

export default function ConnectionBanner() {
  const { connectionState, lastSyncAt, reconnect } = useRealtime()
  const [, tick] = useState(0)

  useEffect(() => {
    if (connectionState === 'connected') return
    const id = setInterval(() => tick((n) => n + 1), 5000)
    return () => clearInterval(id)
  }, [connectionState])

  if (connectionState === 'connected') {
    return (
      <div className="conn-status conn-status--connected" title="Conectado en tiempo real">
        <span className="conn-dot conn-dot--green" />
      </div>
    )
  }

  if (connectionState === 'connecting') {
    return (
      <div className="conn-banner conn-banner--connecting" role="status">
        Conectando…
      </div>
    )
  }

  if (connectionState === 'reconnecting') {
    return (
      <div className="conn-banner conn-banner--reconnecting" role="status">
        Reconectando…
        {lastSyncAt && (
          <span className="conn-sync-hint">
            · Actualizado {formatAgo(lastSyncAt)}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="conn-banner conn-banner--disconnected" role="alert">
      <span>
        Sin conexión — reintentando…
        {lastSyncAt && (
          <span className="conn-sync-hint">
            {' '}· Actualizado {formatAgo(lastSyncAt)}
          </span>
        )}
      </span>
      <button type="button" className="conn-reconnect-btn" onClick={reconnect}>
        Reconectar ahora
      </button>
    </div>
  )
}
