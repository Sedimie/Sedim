'use client'

import { useState, type FormEvent } from 'react'
import { signup } from './auth-client'
import type { AuthError } from './auth-client'

export interface SignupFormProps {
  onSuccess?: (user: { id: string; email: string }) => void
  onError?: (error: AuthError) => void
  redirectTo?: string
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
      const msg = result.error === 'email-taken'
        ? 'An account with this email already exists.'
        : 'Something went wrong. Please try again.'
      setError(msg)
      onError?.(result.error)
      return
    }

    if (redirectTo) {
      window.location.href = redirectTo
    } else {
      onSuccess?.(result.data.user)
    }
  }

  const inputClass = 'rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-email" className="text-sm font-medium text-gray-700">Email</label>
        <input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          required autoComplete="email" disabled={loading} className={inputClass} placeholder="you@example.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-password" className="text-sm font-medium text-gray-700">Password</label>
        <input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
          required autoComplete="new-password" disabled={loading} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-confirm" className="text-sm font-medium text-gray-700">Confirm password</label>
        <input id="signup-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          required autoComplete="new-password" disabled={loading} className={inputClass} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
