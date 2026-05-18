'use client'

import { useState, type FormEvent } from 'react'
import { requestPasswordReset } from './auth-client'
import type { AuthError } from './auth-client'

export interface ForgotPasswordFormProps {
  onSuccess?: () => void
  onError?: (error: AuthError) => void
}

const s = {
  form: { display: 'flex', flexDirection: 'column' as const, gap: '1rem', width: '100%', maxWidth: '24rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' },
  label: { fontSize: 'var(--auth-font-size-sm)', fontWeight: 500, color: 'var(--auth-fg)' },
  input: { borderRadius: 'var(--auth-radius)', border: '1px solid var(--auth-border)', background: 'var(--auth-input-bg)', color: 'var(--auth-fg)', padding: '0.5rem 0.75rem', fontSize: 'var(--auth-font-size-sm)', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  button: { borderRadius: 'var(--auth-radius)', background: 'var(--auth-btn-bg)', color: 'var(--auth-btn-fg)', border: 'none', padding: '0.5rem 1rem', fontSize: 'var(--auth-font-size-sm)', fontWeight: 500, cursor: 'pointer', width: '100%' },
  success: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem', textAlign: 'center' as const },
}

export function ForgotPasswordForm({ onSuccess, onError }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const result = await requestPasswordReset(email)
    setLoading(false)
    if (!result.ok) onError?.(result.error)
    setSent(true)
    onSuccess?.()
  }

  if (sent) {
    return (
      <div role="status" style={s.success}>
        <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)', margin: 0 }}>
          If an account exists for <strong style={{ color: 'var(--auth-fg)' }}>{email}</strong>, you'll receive a reset link shortly.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <div style={s.field}>
        <label htmlFor="forgot-email" style={s.label}>Email</label>
        <input id="forgot-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          required autoComplete="email" disabled={loading} style={s.input} placeholder="you@example.com" />
      </div>
      <button type="submit" disabled={loading} style={{ ...s.button, opacity: loading ? 0.5 : 1 }}>
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}
