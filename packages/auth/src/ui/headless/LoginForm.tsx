'use client'

import { useState, type FormEvent } from 'react'
import { login } from './auth-client'
import type { AuthError } from './auth-client'

export interface LoginFormProps {
  onSuccess?: (user: { id: string; email: string }) => void
  onTotpRequired?: () => void
  onError?: (error: AuthError) => void
  redirectTo?: string
}

export function LoginForm({ onSuccess, onTotpRequired, onError, redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '24rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label htmlFor="login-email" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
          style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box', outline: 'none' }}
          placeholder="you@example.com"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor="login-password" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Password</label>
          <a href="/forgot-password" style={{ fontSize: '0.75rem', color: '#6b7280', textDecoration: 'none' }}>Forgot password?</a>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading}
            style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box', outline: 'none', paddingRight: '3rem' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: '0.5rem', background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" style={{ fontSize: '0.875rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
          {errorMessage(error)}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{ borderRadius: 6, background: '#111827', color: '#fff', border: 'none', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, width: '100%' }}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

function errorMessage(error: AuthError): string {
  switch (error) {
    case 'invalid-credentials': return 'Invalid email or password.'
    case 'account-locked': return 'Too many failed attempts. Try again in 15 minutes.'
    case 'network-error': return 'Network error. Please try again.'
    default: return 'Something went wrong. Please try again.'
  }
}