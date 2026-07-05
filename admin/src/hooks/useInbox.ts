import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useRealtime } from '../context/RealtimeContext'

export interface ConversationSummary {
  id: string
  phoneNumber: string
  contactName: string | null
  userId: string
  status: string
  mode: string
  unreadCountAgent: number
  assignedAgentId: string | null
  assignedAgentName: string | null
  handoffAt: string | null
  lastUserMessageAt: string | null
  lastAgentMessageAt: string | null
  updatedAt: string
  createdAt: string
  lastMessagePreview?: string
}

interface InboxResponse {
  conversations: ConversationSummary[]
  total: number
  limit: number
  offset: number
}

export type AgentInboxFilter = 'own' | 'bot'

interface UseInboxOptions {
  isAdmin?: boolean
  agentFilter?: AgentInboxFilter
  activeConversationId?: string | undefined
}

const FALLBACK_POLL_MS = 60_000

export function useInbox(options: UseInboxOptions = {}) {
  const { isAdmin = false, agentFilter = 'own', activeConversationId } = options
  const { connectionState, subscribe } = useRealtime()
  const wsConnected = connectionState === 'connected'

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetch = useCallback(
    async (initial = false) => {
      if (initial) setLoading(true)
      try {
        const params = new URLSearchParams()
        if (isAdmin) {
          params.set('limit', '100')
        } else if (agentFilter === 'bot') {
          params.set('filter', 'bot')
          params.set('limit', '100')
        }
        const qs = params.toString()
        const data = await api.get<InboxResponse>(`/api/v1/inbox${qs ? `?${qs}` : ''}`)
        setConversations(data.conversations)
        setTotal(data.total)
        setError('')
      } catch (err) {
        if (initial) setError(err instanceof Error ? err.message : 'Error al cargar chats')
      } finally {
        if (initial) setLoading(false)
      }
    },
    [isAdmin, agentFilter],
  )

  useEffect(() => {
    void fetch(true)
  }, [fetch])

  useEffect(() => {
    if (wsConnected) return
    const id = setInterval(() => void fetch(false), FALLBACK_POLL_MS)
    return () => clearInterval(id)
  }, [fetch, wsConnected])

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === 'conversation.read') {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === event.conversationId
              ? { ...c, unreadCountAgent: event.unreadCountAgent }
              : c,
          ),
        )
        return
      }

      if (event.type === 'message.new') {
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === event.conversationId)
          if (idx < 0) {
            void fetch(false)
            return prev
          }

          const conv = prev[idx]!
          const isActive = event.conversationId === activeConversationId
          const isUserMsg = event.message.role === 'user'
          const preview =
            event.message.content.length > 40
              ? `${event.message.content.slice(0, 40)}…`
              : event.message.content
          const updated: ConversationSummary = {
            ...conv,
            updatedAt: event.message.timestamp,
            lastMessagePreview: preview,
            ...(isUserMsg && { lastUserMessageAt: event.message.timestamp }),
            ...(!isUserMsg && { lastAgentMessageAt: event.message.timestamp }),
            unreadCountAgent:
              isUserMsg && !isActive
                ? conv.unreadCountAgent + 1
                : conv.unreadCountAgent,
          }

          const rest = prev.filter((_, i) => i !== idx)
          return [updated, ...rest]
        })
      }
    })
  }, [subscribe, activeConversationId, fetch])

  return { conversations, total, loading, error, reload: () => void fetch(false) }
}
