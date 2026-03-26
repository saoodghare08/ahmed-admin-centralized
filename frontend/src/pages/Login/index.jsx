import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err?.error || err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left: Branding */}
        <div className="login-branding">
          <div className="login-branding-content">
            <div className="login-logo">
              <div className="login-logo-icon">A</div>
              <span className="login-logo-text">Ahmed Al Maghribi</span>
            </div>
            <h1 className="login-branding-title">Central Admin</h1>
            <p className="login-branding-subtitle">
              Manage your GCC storefronts, products, and analytics — all in one place.
            </p>
            <div className="login-branding-decoration">
              <div className="login-decoration-line"></div>
              <div className="login-decoration-line"></div>
              <div className="login-decoration-line"></div>
            </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="login-form-wrapper">
          <div className="login-form-inner">
            <h2 className="login-form-title">Welcome back</h2>
            <p className="login-form-subtitle">Sign in to your account</p>

            <form onSubmit={handleSubmit} className="login-form">
              {error && (
                <div className="login-error">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="login-field">
                <label className="login-label">Username</label>
                <input
                  id="login-username"
                  type="text"
                  className="t-input login-input"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="login-field">
                <label className="login-label">Password</label>
                <input
                  id="login-password"
                  type="password"
                  className="t-input login-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                id="login-submit"
                type="submit"
                className="t-btn-primary login-submit"
                disabled={loading || !username || !password}
              >
                {loading ? (
                  <span className="login-spinner"></span>
                ) : null}
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="login-footer-text">
              GCC · 6 Storefronts · Phase 1
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
