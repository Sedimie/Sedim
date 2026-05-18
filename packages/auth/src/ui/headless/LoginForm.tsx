'use client'

import { useState, type FormEvent } from 'react'
import { login } from './auth-client'
import type { AuthError } from './auth-client'

export interface LoginFormProps {
  /** Called on successful login. Receives the logged-in user. */
  onSuccess?: (user: { id: string; email: string }) => void
  /** Called when server returns TOTP required — render TotpVerifyForm next. */
  onTotpRequired?: () => void
  /** Called on any auth error. */
  onError?: (error: AuthError) => void
  /** Redirect URL after login. If provided, does window.location.href instead of onSuccess. */
  redirectTo?: string
}

export function LoginForm({ onSuccess, onTotpRequired, onError, redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<AuthError | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await login(email, password)
    setLoading(false)

    if (!result.ok) {
      setError(result.error)
      onError?.(result.error)
      return
    }

    if ('requiresTotp' in result.data) {
      onTotpRequired?.()
      return
    }

    if (redirectTo) {
      window.location.href = redirectTo
    } else {
      onSuccess?.(result.data.user)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
        />
      </div>
      {error && <p role="alert">{errorMessage(error)}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

function errorMessage(error: AuthError): string {
  switch (error) {
    case 'invalid-credentials': return 'Invalid email or password.'
    case 'network-error': return 'Network error. Please try again.'
    default: return 'Something went wrong. Please try again.'
  }
}
