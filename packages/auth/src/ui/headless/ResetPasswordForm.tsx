'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { confirmPasswordReset } from './auth-client'
import type { AuthError } from './auth-client'

export interface ResetPasswordFormProps {
  /** Token from the URL query param — pass it in from the page. */
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

  // read token from URL if not passed as prop
  useEffect(() => {
    if (!tokenProp && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('token')
      if (t) setToken(t)
    }
  }, [tokenProp])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!token) {
      setError('Reset token is missing. Please use the link from your email.')
      return
    }

    setLoading(true)
    const result = await confirmPasswordReset(token, password)
    setLoading(false)

    if (!result.ok) {
      const msg = result.error === 'token-expired'
        ? 'This reset link has expired. Please request a new one.'
        : result.error === 'token-invalid'
          ? 'Invalid reset link. Please request a new one.'
          : 'Something went wrong. Please try again.'
      setError(msg)
      onError?.(result.error)
      return
    }

    setDone(true)
    onSuccess?.()
    if (redirectTo) {
      setTimeout(() => { window.location.href = redirectTo }, 1500)
    }
  }

  if (done) {
    return (
      <div role="status">
        <p>Password updated. {redirectTo ? 'Redirecting…' : 'You can now sign in.'}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="reset-password">New password</label>
        <input
          id="reset-password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor="reset-confirm">Confirm new password</label>
        <input
          id="reset-confirm"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}
