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

export function useInbox(pollIntervalMs = 5000) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetch = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    try {
      const data = await api.get<InboxResponse>('/api/v1/inbox')
      setConversations(data.conversations)
      setTotal(data.total)
      setError('')
    } catch (err) {
      if (initial) setError(err instanceof Error ? err.message : 'Error al cargar chats')
    } finally {
      if (initial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetch(true)
    const id = setInterval(() => void fetch(false), pollIntervalMs)
    return () => clearInterval(id)
  }, [fetch, pollIntervalMs])

  return { conversations, total, loading, error }
}
