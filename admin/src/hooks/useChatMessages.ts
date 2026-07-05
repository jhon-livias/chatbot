import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useRealtime } from '../context/RealtimeContext'
import type { MessageEventData } from '../types/realtime'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'agent' | 'system'
  content: string
  status: string
  timestamp: string
  externalId?: string
  deliveredAt?: string
  readAt?: string
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

const FALLBACK_POLL_MS = 60_000

function toChatMessage(data: MessageEventData): ChatMessage {
  return {
    id: data.id,
    role: data.role,
    content: data.content,
    status: data.status,
    timestamp: data.timestamp,
    ...(data.externalId !== undefined && { externalId: data.externalId }),
    ...(data.deliveredAt !== undefined && { deliveredAt: data.deliveredAt }),
    ...(data.readAt !== undefined && { readAt: data.readAt }),
    ...(data.metadata !== undefined && { metadata: data.metadata }),
  }
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const idx = existing.findIndex((m) => m.id === incoming.id)
  if (idx >= 0) {
    const next = [...existing]
    next[idx] = { ...next[idx], ...incoming }
    return next
  }
  return [...existing, incoming]
}

export function useChatMessages(conversationId: string) {
  const { connectionState, subscribe } = useRealtime()
  const wsConnected = connectionState === 'connected'

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
  }, [fetch])

  useEffect(() => {
    if (wsConnected) return
    const id = setInterval(() => void fetch(false), FALLBACK_POLL_MS)
    return () => clearInterval(id)
  }, [fetch, wsConnected])

  useEffect(() => {
    return subscribe((event) => {
      if (event.conversationId !== conversationId) return

      if (event.type === 'message.new') {
        const msg = toChatMessage(event.message)
        setMessages((prev) => mergeMessages(prev, msg))
      }

      if (event.type === 'message.status') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId
              ? {
                  ...m,
                  status: event.status,
                  ...(event.deliveredAt !== undefined && { deliveredAt: event.deliveredAt }),
                  ...(event.readAt !== undefined && { readAt: event.readAt }),
                }
              : m,
          ),
        )
      }

      if (event.type === 'conversation.read') {
        setMeta((prev) =>
          prev ? { ...prev, unreadCountAgent: event.unreadCountAgent } : prev,
        )
      }
    })
  }, [conversationId, subscribe])

  return { messages, meta, loading, error, forbidden, reload: () => void fetch(false) }
}
