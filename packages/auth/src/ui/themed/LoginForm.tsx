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

const s = {
  form: { display: 'flex', flexDirection: 'column' as const, gap: '1rem', width: '100%', maxWidth: '24rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' },
  label: { fontSize: 'var(--auth-font-size-sm)', fontWeight: 500, color: 'var(--auth-fg)' },
  input: {
    borderRadius: 'var(--auth-radius)',
    border: '1px solid var(--auth-border)',
    background: 'var(--auth-input-bg)',
    color: 'var(--auth-fg)',
    padding: '0.5rem 0.75rem',
    fontSize: 'var(--auth-font-size-sm)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  error: {
    fontSize: 'var(--auth-font-size-sm)',
    color: 'var(--auth-error-fg)',
    background: 'var(--auth-error-bg)',
    border: '1px solid var(--auth-error-border)',
    borderRadius: 'var(--auth-radius)',
    padding: '0.5rem 0.75rem',
  },
  button: {
    borderRadius: 'var(--auth-radius)',
    background: 'var(--auth-btn-bg)',
    color: 'var(--auth-btn-fg)',
    border: 'none',
    padding: '0.5rem 1rem',
    fontSize: 'var(--auth-font-size-sm)',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
  },
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
    if (!result.ok) { setError(result.error); onError?.(result.error); return }
    if ('requiresTotp' in result.data) { onTotpRequired?.(); return }
    if (redirectTo) { window.location.href = redirectTo } else { onSuccess?.(result.data.user) }
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <div style={s.field}>
        <label htmlFor="login-email" style={s.label}>Email</label>
        <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          required autoComplete="email" disabled={loading} style={s.input} placeholder="you@example.com" />
      </div>
      <div style={s.field}>
        <label htmlFor="login-password" style={s.label}>Password</label>
        <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          required autoComplete="current-password" disabled={loading} style={s.input} />
      </div>
      {error && <p role="alert" style={s.error}>{error === 'invalid-credentials' ? 'Invalid email or password.' : 'Something went wrong.'}</p>}
      <button type="submit" disabled={loading} style={{ ...s.button, opacity: loading ? 0.5 : 1 }}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
