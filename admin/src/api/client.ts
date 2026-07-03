const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export interface ApiError {
  error: string
  status: number
}

function getToken(): string | null {
  return localStorage.getItem('uprit_agent_token')
}

function logout(): void {
  localStorage.removeItem('uprit_agent_token')
  window.location.href = '/login'
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    logout()
    throw new Error('Sesión expirada. Inicia sesión de nuevo.')
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string }
    const err = new Error(body.error ?? res.statusText) as Error & { status: number }
    err.status = res.status
    throw err
  }

  return res.json() as Promise<T>
}

export const api = {
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  },
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' })
  },
}

export { logout }
