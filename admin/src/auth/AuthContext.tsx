import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { api, logout as apiLogout } from '../api/client'

export interface AgentInfo {
  id: string
  name: string
  username: string
  email: string
}

interface AuthState {
  token: string | null
  agent: AgentInfo | null
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadInitialState(): AuthState {
  const token = localStorage.getItem('uprit_agent_token')
  const raw = localStorage.getItem('uprit_agent_info')
  const agent = raw ? (JSON.parse(raw) as AgentInfo) : null
  return { token, agent }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitialState)

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.post<{ token: string; agent: AgentInfo }>('/api/v1/auth/login', {
      username,
      password,
    })
    localStorage.setItem('uprit_agent_token', data.token)
    localStorage.setItem('uprit_agent_info', JSON.stringify(data.agent))
    setState({ token: data.token, agent: data.agent })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('uprit_agent_token')
    localStorage.removeItem('uprit_agent_info')
    setState({ token: null, agent: null })
    apiLogout()
  }, [])

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, isAuthenticated: state.token !== null }}
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
