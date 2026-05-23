'use client'

import { useState, type FormEvent } from 'react'
import { requestMagicLink } from './auth-client'
import type { AuthError } from './auth-client'

export interface MagicLinkFormProps {
  onSuccess?: () => void
  onError?: (error: AuthError) => void
}

const s = {
  form: { display: 'flex', flexDirection: 'column' as const, gap: '1rem', width: '100%', maxWidth: '24rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' },
  label: { fontSize: 'var(--auth-font-size-sm)', fontWeight: 500, color: 'var(--auth-fg)' },
  input: { borderRadius: 'var(--auth-radius)', border: '1px solid var(--auth-border)', background: 'var(--auth-input-bg)', color: 'var(--auth-fg)', padding: '0.5rem 0.75rem', fontSize: 'var(--auth-font-size-sm)', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  button: { borderRadius: 'var(--auth-radius)', background: 'var(--auth-btn-bg)', color: 'var(--auth-btn-fg)', border: 'none', padding: '0.5rem 1rem', fontSize: 'var(--auth-font-size-sm)', fontWeight: 500, cursor: 'pointer', width: '100%' },
  error: { fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-error-fg)', background: 'var(--auth-error-bg)', border: '1px solid var(--auth-error-border)', borderRadius: 'var(--auth-radius)', padding: '0.5rem 0.75rem' },
  success: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem', textAlign: 'center' as const },
}

export function MagicLinkForm({ onSuccess, onError }: MagicLinkFormProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await requestMagicLink(email)
    setLoading(false)

    if (!result.ok) {
      setError(result.error)
      onError?.(result.error)
      return
    }

    setSent(true)
    onSuccess?.()
  }

  if (sent) {
    return (
      <div role="status" style={s.success}>
        <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)', margin: 0 }}>
          Check your email — we sent a sign-in link to <strong style={{ color: 'var(--auth-fg)' }}>{email}</strong>.
        </p>
        <button type="button" onClick={() => setSent(false)} style={{ background: 'transparent', border: '1px solid var(--auth-border)', borderRadius: 'var(--auth-radius)', padding: '0.375rem 0.75rem', fontSize: 'var(--auth-font-size-sm)', cursor: 'pointer', color: 'var(--auth-fg)' }}>
          Send again
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <div style={s.field}>
        <label htmlFor="magic-email" style={s.label}>Email</label>
        <input
          id="magic-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
          style={s.input}
          placeholder="you@example.com"
        />
      </div>
      {error && <p role="alert" style={s.error}>Network error. Please try again.</p>}
      <button type="submit" disabled={loading} style={{ ...s.button, opacity: loading ? 0.5 : 1 }}>
        {loading ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  )
}