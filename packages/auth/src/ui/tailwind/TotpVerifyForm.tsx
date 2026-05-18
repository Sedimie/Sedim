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
    const result = useBackup ? await verifyBackupCode(code) : await verifyTotp(code)
    setLoading(false)
    if (!result.ok) { setError(result.error); onError?.(result.error); return }
    if (redirectTo) { window.location.href = redirectTo } else { onSuccess?.(result.data.user) }
  }

  const inputClass = 'rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 w-full'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
      <div className="text-center">
        <p className="text-sm text-gray-600">
          {useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="totp-code" className="text-sm font-medium text-gray-700">
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
          className={inputClass}
          placeholder={useBackup ? 'XXXX-XXXX' : '000000'}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-center">
          {error === 'totp-invalid' ? 'Invalid code. Please try again.' : 'Something went wrong.'}
        </p>
      )}
      <button type="submit" disabled={loading || code.length < (useBackup ? 9 : 6)}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? 'Verifying…' : 'Verify'}
      </button>
      <button type="button" onClick={() => { setUseBackup(b => !b); setCode(''); setError(null) }}
        className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700 text-center">
        {useBackup ? 'Use authenticator app instead' : 'Use a backup code instead'}
      </button>
    </form>
  )
}
