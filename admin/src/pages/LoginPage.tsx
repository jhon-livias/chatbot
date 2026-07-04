import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const HERO_IMAGE =
  'https://images.pexels.com/photos/267885/pexels-photo-267885.jpeg?auto=compress&cs=tinysrgb&w=1200'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="login-page">
      <div className="login-container">
        <div className="login-grid">
          <div className="login-panel">
            <div className="login-header">
              <div className="login-brand">
                <img
                  src="/logo-uprit-light.svg"
                  alt="UPRIT Universidad Privada de Trujillo"
                  className="login-brand-logo"
                />
              </div>
              <h1 className="login-title">Acceso administrativo</h1>
              <p className="login-subtitle">
                Ingrese sus credenciales para entrar al sistema
              </p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="username">Usuario</label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="tu.nombre"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <button type="submit" className="btn btn-login btn-full" disabled={loading}>
                {loading ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </form>
          </div>

          <div className="login-hero" aria-hidden="true">
            <img
              src={HERO_IMAGE}
              alt=""
              className="login-hero-image"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
