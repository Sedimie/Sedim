'use client'

import { useState, type FormEvent } from 'react'
import { requestMagicLink } from './auth-client'
import type { AuthError } from './auth-client'

export interface MagicLinkFormProps {
  onSuccess?: () => void
  onError?: (error: AuthError) => void
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
    if (!result.ok) { setError(result.error); onError?.(result.error); return }
    setSent(true)
    onSuccess?.()
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-3 w-full max-w-sm text-center">
        <div className="rounded-full bg-green-100 w-12 h-12 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-gray-600">
          Check your email — we sent a sign-in link to <strong className="text-gray-900">{email}</strong>.
        </p>
        <button type="button" onClick={() => setSent(false)}
          className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700">
          Send again
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="magic-email" className="text-sm font-medium text-gray-700">Email</label>
        <input id="magic-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
          required autoComplete="email" disabled={loading}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50"
          placeholder="you@example.com" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error === 'network-error' ? 'Network error. Please try again.' : 'Something went wrong.'}
        </p>
      )}
      <button type="submit" disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  )
}
