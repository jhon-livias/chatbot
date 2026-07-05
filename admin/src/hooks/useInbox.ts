import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

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
}

export function useInbox(pollIntervalMs = 5000, options: UseInboxOptions = {}) {
  const { isAdmin = false, agentFilter = 'own' } = options
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
    const id = setInterval(() => void fetch(false), pollIntervalMs)
    return () => clearInterval(id)
  }, [fetch, pollIntervalMs])

  return { conversations, total, loading, error, reload: () => void fetch(false) }
}
