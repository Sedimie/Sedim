'use client'

import { useState, type FormEvent } from 'react'
import { verifyTotp, verifyBackupCode } from './auth-client'
import type { AuthError } from './auth-client'

export interface TotpVerifyFormProps {
  onSuccess?: (user: { id: string; email: string }) => void
  onError?: (error: AuthError) => void
  redirectTo?: string
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

    const result = useBackup
      ? await verifyBackupCode(code)
      : await verifyTotp(code)

    setLoading(false)

    if (!result.ok) {
      setError(result.error)
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
    <form onSubmit={handleSubmit}>
      <p>
        {useBackup
          ? 'Enter one of your backup codes.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>
      <div>
        <label htmlFor="totp-code">
          {useBackup ? 'Backup code' : 'Authenticator code'}
        </label>
        <input
          id="totp-code"
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\s/g, ''))}
          required
          autoComplete="one-time-code"
          inputMode={useBackup ? 'text' : 'numeric'}
          maxLength={useBackup ? 9 : 6}
          disabled={loading}
        />
      </div>
      {error && (
        <p role="alert">
          {error === 'totp-invalid' ? 'Invalid code. Please try again.' : 'Something went wrong.'}
        </p>
      )}
      <button type="submit" disabled={loading || code.length < (useBackup ? 9 : 6)}>
        {loading ? 'Verifying…' : 'Verify'}
      </button>
      <button
        type="button"
        onClick={() => { setUseBackup(b => !b); setCode(''); setError(null) }}
      >
        {useBackup ? 'Use authenticator app instead' : 'Use a backup code instead'}
      </button>
    </form>
  )
}
