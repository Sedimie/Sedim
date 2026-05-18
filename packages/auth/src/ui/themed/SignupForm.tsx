'use client'

import { useState, type FormEvent } from 'react'
import { signup } from './auth-client'
import type { AuthError } from './auth-client'

export interface SignupFormProps {
  onSuccess?: (user: { id: string; email: string }) => void
  onError?: (error: AuthError) => void
  redirectTo?: string
}

const s = {
  form: { display: 'flex', flexDirection: 'column' as const, gap: '1rem', width: '100%', maxWidth: '24rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' },
  label: { fontSize: 'var(--auth-font-size-sm)', fontWeight: 500, color: 'var(--auth-fg)' },
  input: { borderRadius: 'var(--auth-radius)', border: '1px solid var(--auth-border)', background: 'var(--auth-input-bg)', color: 'var(--auth-fg)', padding: '0.5rem 0.75rem', fontSize: 'var(--auth-font-size-sm)', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  error: { fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-error-fg)', background: 'var(--auth-error-bg)', border: '1px solid var(--auth-error-border)', borderRadius: 'var(--auth-radius)', padding: '0.5rem 0.75rem' },
  button: { borderRadius: 'var(--auth-radius)', background: 'var(--auth-btn-bg)', color: 'var(--auth-btn-fg)', border: 'none', padding: '0.5rem 1rem', fontSize: 'var(--auth-font-size-sm)', fontWeight: 500, cursor: 'pointer', width: '100%' },
}

export function SignupForm({ onSuccess, onError, redirectTo }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
      setError(result.error === 'email-taken' ? 'An account with this email already exists.' : 'Something went wrong.')
      onError?.(result.error)
      return
    }
    if (redirectTo) { window.location.href = redirectTo } else { onSuccess?.(result.data.user) }
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <div style={s.field}>
        <label htmlFor="signup-email" style={s.label}>Email</label>
        <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" disabled={loading} style={s.input} placeholder="you@example.com" />
      </div>
      <div style={s.field}>
        <label htmlFor="signup-password" style={s.label}>Password</label>
        <input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" disabled={loading} style={s.input} />
      </div>
      <div style={s.field}>
        <label htmlFor="signup-confirm" style={s.label}>Confirm password</label>
        <input id="signup-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" disabled={loading} style={s.input} />
      </div>
      {error && <p role="alert" style={s.error}>{error}</p>}
      <button type="submit" disabled={loading} style={{ ...s.button, opacity: loading ? 0.5 : 1 }}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
