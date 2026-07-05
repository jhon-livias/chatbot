import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'agent' | 'system'
  content: string
  status: string
  timestamp: string
  externalId?: string
  metadata?: Record<string, unknown>
}

interface ConversationMeta {
  conversationId: string
  phoneNumber: string
  contactName: string | null
  userId: string
  mode: string
  status: string
  assignedAgentId: string | null
  assignedAgentName: string | null
  unreadCountAgent: number
}

interface HistoryResponse extends ConversationMeta {
  messages: ChatMessage[]
}

export function useChatMessages(conversationId: string, pollIntervalMs = 4000) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [meta, setMeta] = useState<ConversationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)

  const fetch = useCallback(
    async (initial = false) => {
      if (!conversationId) return
      if (initial) setLoading(true)
      try {
        const data = await api.get<HistoryResponse>(
          `/api/v1/conversations/${conversationId}/messages`,
        )
        setMessages(data.messages)
        setMeta({
          conversationId: data.conversationId,
          phoneNumber: data.phoneNumber,
          contactName: data.contactName ?? null,
          userId: data.userId,
          mode: data.mode,
          status: data.status,
          assignedAgentId: data.assignedAgentId,
          assignedAgentName: data.assignedAgentName ?? null,
          unreadCountAgent: data.unreadCountAgent,
        })
        setError('')
        setForbidden(false)
      } catch (err) {
        const e = err as Error & { status?: number }
        if (e.status === 403) {
          setForbidden(true)
        } else if (initial) {
          setError(e.message ?? 'Error al cargar mensajes')
        }
      } finally {
        if (initial) setLoading(false)
      }
    },
    [conversationId],
  )

  useEffect(() => {
    void fetch(true)
    const id = setInterval(() => void fetch(false), pollIntervalMs)
    return () => clearInterval(id)
  }, [fetch, pollIntervalMs])

  return { messages, meta, loading, error, forbidden, reload: () => void fetch(false) }
}
