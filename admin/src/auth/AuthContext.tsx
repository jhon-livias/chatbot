import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { api, logout as apiLogout } from '../api/client'
import { normalizeAgent, resolveIsAdmin, type AgentInfo } from './auth-utils'

export type { AgentInfo }

interface AuthState {
  token: string | null
  agent: AgentInfo | null
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
  /** Bumps on each login so routed views remount with fresh auth-derived UI. */
  sessionKey: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadInitialState(): AuthState {
  const token = localStorage.getItem('uprit_agent_token')
  const raw = localStorage.getItem('uprit_agent_info')
  const parsed = raw ? (JSON.parse(raw) as AgentInfo) : null
  const agent = normalizeAgent(parsed, token)
  if (agent && raw && parsed && !parsed.role && agent.role) {
    localStorage.setItem('uprit_agent_info', JSON.stringify(agent))
  }
  return { token, agent }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitialState)
  const [sessionKey, setSessionKey] = useState(() =>
    state.token ? `${state.token.slice(-12)}:${state.agent?.id ?? ''}` : 'anon',
  )

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.post<{ token: string; agent: AgentInfo }>('/api/v1/auth/login', {
      username,
      password,
    })
    const agent = normalizeAgent(data.agent, data.token)
    if (!agent) throw new Error('Respuesta de login inválida')

    localStorage.setItem('uprit_agent_token', data.token)
    localStorage.setItem('uprit_agent_info', JSON.stringify(agent))

    flushSync(() => {
      setState({ token: data.token, agent })
      setSessionKey(`${data.token.slice(-12)}:${agent.id}:${agent.role}`)
    })
  }, [])

  const logout = useCallback(() => {
    const token = localStorage.getItem('uprit_agent_token')
    if (token) {
      void fetch(`${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => void 0)
    }
    localStorage.removeItem('uprit_agent_token')
    localStorage.removeItem('uprit_agent_info')
    setState({ token: null, agent: null })
    setSessionKey('anon')
    apiLogout()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        isAuthenticated: state.token !== null,
        isAdmin: resolveIsAdmin(state.agent, state.token),
        sessionKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
