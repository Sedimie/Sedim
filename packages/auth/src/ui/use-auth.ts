// src/sedim/auth/ui/use-auth.ts
// ── useAuth hook ──────────────────────────────────────────────
// Client-side session state. Works in React and Next.js Client Components.
// For Server Components use getSession(authConfig) from the barrel instead.
//
// Usage:
//   const { user, loading } = useAuth()

'use client'

import { useEffect, useState } from 'react'
import { getSession } from './auth-client'
import type { AuthUser } from './auth-client'

export interface UseAuthReturn {
  user: AuthUser | null
  loading: boolean
  /** Call after login/logout to re-fetch session without a full page reload. */
  refresh: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    const u = await getSession()
    setUser(u)
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  return { user, loading, refresh }
}
