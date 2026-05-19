'use client'

import { useState, type FormEvent } from 'react'
import { signup } from './auth-client'
import type { AuthError } from './auth-client'

export interface SignupFormProps {
  onSuccess?: (user: { id: string; email: string }) => void
  onError?: (error: AuthError) => void
  redirectTo?: string
}

export function SignupForm({ onSuccess, onError, redirectTo }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    const result = await signup(email, password)
    setLoading(false)

    if (!result.ok) {
      const msg = result.error === 'email-taken'
        ? 'An account with this email already exists.'
        : 'Something went wrong. Please try again.'
      setError(msg)
      onError?.(result.error)
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
        <label htmlFor="signup-email" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Email</label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-password" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Password</label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="new-password"
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
        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>At least 8 characters</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label htmlFor="signup-confirm" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Confirm password</label>
        <input
          id="signup-confirm"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
          style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box', outline: 'none' }}
        />
      </div>
      {error && (
        <p role="alert" style={{ fontSize: '0.875rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{ borderRadius: 6, background: '#111827', color: '#fff', border: 'none', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, width: '100%' }}
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}