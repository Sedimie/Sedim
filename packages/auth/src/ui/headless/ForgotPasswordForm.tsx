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
      <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'center', maxWidth: '24rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
          <svg style={{ width: 24, height: 24, color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', fontWeight: 500, margin: '0 0 0.25rem' }}>Check your email</p>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            If an account exists for <strong>{email}</strong>, you&apos;ll receive a reset link shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '24rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label htmlFor="forgot-email" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Email</label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
          style={{ borderRadius: 6, border: '1px solid #d1d5db', padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box', outline: 'none' }}
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        style={{ borderRadius: 6, background: '#111827', color: '#fff', border: 'none', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, width: '100%' }}
      >
        {loading ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}