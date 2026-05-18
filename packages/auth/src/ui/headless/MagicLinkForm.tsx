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
      <div role="status">
        <p>Check your email — we sent a sign-in link to <strong>{email}</strong>.</p>
        <button type="button" onClick={() => setSent(false)}>
          Send again
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="magic-email">Email</label>
        <input
          id="magic-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
        />
      </div>
      {error && <p role="alert">{error === 'network-error' ? 'Network error. Please try again.' : 'Something went wrong.'}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  )
}
