'use client'

import { useState, type FormEvent } from 'react'
import { verifyTotp, verifyBackupCode } from './auth-client'
import type { AuthError } from './auth-client'

export interface TotpVerifyFormProps {
  onSuccess?: (user: { id: string; email: string }) => void
  onError?: (error: AuthError) => void
  redirectTo?: string
}

const s = {
  form: { display: 'flex', flexDirection: 'column' as const, gap: '1rem', width: '100%', maxWidth: '20rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' },
  label: { fontSize: 'var(--auth-font-size-sm)', fontWeight: 500, color: 'var(--auth-fg)' },
  input: { borderRadius: 'var(--auth-radius)', border: '1px solid var(--auth-border)', background: 'var(--auth-input-bg)', color: 'var(--auth-fg)', padding: '0.5rem 0.75rem', fontSize: '1.25rem', letterSpacing: '0.25em', fontFamily: 'monospace', textAlign: 'center' as const, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  error: { fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-error-fg)', background: 'var(--auth-error-bg)', border: '1px solid var(--auth-error-border)', borderRadius: 'var(--auth-radius)', padding: '0.5rem 0.75rem', textAlign: 'center' as const },
  button: { borderRadius: 'var(--auth-radius)', background: 'var(--auth-btn-bg)', color: 'var(--auth-btn-fg)', border: 'none', padding: '0.5rem 1rem', fontSize: 'var(--auth-font-size-sm)', fontWeight: 500, cursor: 'pointer', width: '100%' },
  link: { fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', width: '100%', textAlign: 'center' as const },
}

export function TotpVerifyForm({ onSuccess, onError, redirectTo }: TotpVerifyFormProps) {
  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = useBackup ? await verifyBackupCode(code) : await verifyTotp(code)
    setLoading(false)
    if (!result.ok) { setError(result.error); onError?.(result.error); return }
    if (redirectTo) { window.location.href = redirectTo } else { onSuccess?.(result.data.user) }
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <p style={{ fontSize: 'var(--auth-font-size-sm)', color: 'var(--auth-muted)', textAlign: 'center', margin: 0 }}>
        {useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
      </p>
      <div style={s.field}>
        <label htmlFor="totp-code" style={s.label}>{useBackup ? 'Backup code' : 'Authenticator code'}</label>
        <input id="totp-code" type="text" value={code} onChange={e => setCode(e.target.value.replace(/\s/g, ''))}
          required autoComplete="one-time-code" inputMode={useBackup ? 'text' : 'numeric'}
          maxLength={useBackup ? 9 : 6} disabled={loading} style={s.input}
          placeholder={useBackup ? 'XXXX-XXXX' : '000000'} />
      </div>
      {error && <p role="alert" style={s.error}>{error === 'totp-invalid' ? 'Invalid code. Please try again.' : 'Something went wrong.'}</p>}
      <button type="submit" disabled={loading || code.length < (useBackup ? 9 : 6)} style={{ ...s.button, opacity: (loading || code.length < (useBackup ? 9 : 6)) ? 0.5 : 1 }}>
        {loading ? 'Verifying…' : 'Verify'}
      </button>
      <button type="button" onClick={() => { setUseBackup(b => !b); setCode(''); setError(null) }} style={s.link}>
        {useBackup ? 'Use authenticator app instead' : 'Use a backup code instead'}
      </button>
    </form>
  )
}
