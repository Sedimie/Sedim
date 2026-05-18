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
      setError(
        result.error === 'token-expired' ? 'This reset link has expired. Please request a new one.'
        : result.error === 'token-invalid' ? 'Invalid reset link. Please request a new one.'
        : 'Something went wrong. Please try again.'
      )
      onError?.(result.error)
      return
    }

    setDone(true)
    onSuccess?.()
    if (redirectTo) setTimeout(() => { window.location.href = redirectTo }, 1500)
  }

  const inputClass = 'rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50'

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-3 w-full max-w-sm text-center">
        <div className="rounded-full bg-green-100 w-12 h-12 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-gray-600">Password updated. {redirectTo ? 'Redirecting…' : 'You can now sign in.'}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-password" className="text-sm font-medium text-gray-700">New password</label>
        <input id="reset-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          required autoComplete="new-password" disabled={loading} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-confirm" className="text-sm font-medium text-gray-700">Confirm new password</label>
        <input id="reset-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          required autoComplete="new-password" disabled={loading} className={inputClass} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}
