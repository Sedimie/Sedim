'use client'

import { useState, type FormEvent } from 'react'
import { requestPasswordReset } from './auth-client'
import type { AuthError } from './auth-client'

export interface ForgotPasswordFormProps {
  onSuccess?: () => void
  onError?: (error: AuthError) => void
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

    if (!result.ok) {
      onError?.(result.error)
    }

    setSent(true)
    onSuccess?.()
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-3 items-center text-center">
        <div className="rounded-full bg-green-100 w-12 h-12 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 mb-1">Check your email</p>
          <p className="text-sm text-gray-500">
            If an account exists for <strong className="text-gray-700">{email}</strong>, you&apos;ll receive a reset link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-email" className="text-sm font-medium text-gray-700">Email</label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}