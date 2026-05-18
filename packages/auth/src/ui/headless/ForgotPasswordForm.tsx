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
      // still show success — don't leak whether email exists
    }

    setSent(true)
    onSuccess?.()
  }

  if (sent) {
    return (
      <div role="status">
        <p>If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="forgot-email">Email</label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
        />
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}
