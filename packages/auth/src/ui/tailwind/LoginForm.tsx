'use client'

import { useState, type FormEvent } from 'react'
import { login } from './auth-client'
import type { AuthError } from './auth-client'

export interface LoginFormProps {
  onSuccess?: (user: { id: string; email: string }) => void
  onTotpRequired?: () => void
  onError?: (error: AuthError) => void
  redirectTo?: string
}

export function LoginForm({ onSuccess, onTotpRequired, onError, redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await login(email, password)
    setLoading(false)

    if (!result.ok) {
      setError(result.error)
      onError?.(result.error)
      return
    }

    if ('requiresTotp' in result.data) {
      onTotpRequired?.()
      return
    }

    if (redirectTo) {
      window.location.href = redirectTo
    } else {
      onSuccess?.(result.data.user)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium text-gray-700">Email</label>
        <input
          id="login-email"
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
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <label htmlFor="login-password" className="text-sm font-medium text-gray-700">Password</label>
          <a href="/forgot-password" className="text-xs text-gray-500 hover:text-indigo-600">Forgot password?</a>
        </div>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {errorMessage(error)}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

function errorMessage(error: AuthError): string {
  switch (error) {
    case 'invalid-credentials': return 'Invalid email or password.'
    case 'account-locked': return 'Too many failed attempts. Try again in 15 minutes.'
    case 'network-error': return 'Network error. Please try again.'
    default: return 'Something went wrong. Please try again.'
  }
}