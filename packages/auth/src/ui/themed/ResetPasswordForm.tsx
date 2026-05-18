'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { confirmPasswordReset } from './auth-client'
import type { AuthError } from './auth-client'

export interface ResetPasswordFormProps {
  token?: string
  onSuccess?: () => void
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

export function ResetPasswordForm({ token: tokenProp, onSuccess, onError, redirectTo }: ResetPasswordFormProps) {
  const [token, setToken] = useState(tokenProp ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tokenProp && typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('token')
      if (t) setToken(t)
    }
  }, [tokenProp])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!token) { setError('Reset token is missing. Please use the link from your email.'); return }
    setLoading(true)
    const result = await confirmPasswordReset(token, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error === 'token-expired' ? 'This reset link has expired.' : result.error === 'token-invalid' ? 'Invalid reset link.' : 'Something went wrong.')
      onError?.(result.error)
      return
    }
    setDone(true)
    onSuccess?.()
    if (redirectTo) setTimeout(() => { window.location.href = redirectTo }, 1500)
  }

  if (done) {
    return (
      <div role="status" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)', margin: 0 }}>
          Password updated. {redirectTo ? 'Redirecting…' : 'You can now sign in.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <div style={s.field}>
        <label htmlFor="reset-password" style={s.label}>New password</label>
        <input id="reset-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" disabled={loading} style={s.input} />
      </div>
      <div style={s.field}>
        <label htmlFor="reset-confirm" style={s.label}>Confirm new password</label>
        <input id="reset-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" disabled={loading} style={s.input} />
      </div>
      {error && <p role="alert" style={s.error}>{error}</p>}
      <button type="submit" disabled={loading} style={{ ...s.button, opacity: loading ? 0.5 : 1 }}>
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}
