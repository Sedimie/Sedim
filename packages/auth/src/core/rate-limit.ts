// src/sedim/auth/core/rate-limit.ts
// ── Rate limiter for auth endpoints ────────────────────────────
// Sliding-window attempt counter. Tracks by IP + optional identity.
//
// For production with multiple server instances, replace the in-memory
// store with a Redis-backed store. The interface is designed for that.
//
// What each auth action needs:
//   login, signup      → 5 attempts / 15 min per IP + email combo
//   magic-link, reset  → 3 attempts / 15 min per email
//   totp-verify        → 5 attempts / 5 min per session/user

export interface RateLimitConfig {
  /** Max attempts in the window. */
  maxAttempts: number
  /** Window size in milliseconds. Default: 15 minutes. */
  windowMs?: number
  /** How long to block after maxAttempts is reached (ms). Default: 15 min. */
  blockMs?: number
}

interface AttemptEntry {
  count: number
  oldest: number
  blockedUntil: number | null
}

type MemoryStore = Map<string, AttemptEntry>

export interface RateLimiter {
  /**
   * Check if an action is allowed. Call BEFORE performing the auth action.
   * Returns { allowed: true } if under the limit.
   * Returns { allowed: false, retryAfterMs } if rate-limited.
   */
  check(key: string): { allowed: boolean; retryAfterMs?: number }
  /**
   * Record a failed attempt. Call after a failed auth attempt.
   */
  hit(key: string): void
  /**
   * Reset all counters for a key. Call after a successful auth action.
   */
  clear(key: string): void
}

/**
 * Creates an in-memory rate limiter.
 * For multi-instance deployments, swap the store for a Redis equivalent.
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const { maxAttempts, windowMs = 15 * 60 * 1000, blockMs = 15 * 60 * 1000 } = config
  const store: MemoryStore = new Map()

  return {
    check(key: string) {
      const now = Date.now()
      const entry = store.get(key)

      if (!entry) return { allowed: true }

      if (entry.blockedUntil !== null && now < entry.blockedUntil) {
        return { allowed: false, retryAfterMs: entry.blockedUntil - now }
      }

      if (now - entry.oldest > windowMs && entry.count === 1) {
        store.delete(key)
        return { allowed: true }
      }

      if (now - entry.oldest > windowMs) {
        entry.count = 0
        entry.oldest = now
        entry.blockedUntil = null
        store.set(key, entry)
        return { allowed: true }
      }

      if (entry.count >= maxAttempts) {
        entry.blockedUntil = now + blockMs
        store.set(key, entry)
        return { allowed: false, retryAfterMs: blockMs }
      }

      return { allowed: true }
    },

    hit(key: string) {
      const now = Date.now()
      const entry = store.get(key)

      if (!entry || now - entry.oldest > windowMs) {
        store.set(key, { count: 1, oldest: now, blockedUntil: null })
        return
      }

      entry.count++
      store.set(key, entry)
    },

    clear(key: string) {
      store.delete(key)
    },
  }
}

/** Login rate limiter: 5 attempts per 15 minutes per IP+email. */
export const loginLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 })

/** Signup rate limiter: 5 attempts per 15 minutes per IP. */
export const signupLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 })

/** Magic link / password reset rate limiter: 3 attempts per 15 minutes per email. */
export const emailLimiter = createRateLimiter({ maxAttempts: 3, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 })

/** TOTP verify rate limiter: 5 attempts per 5 minutes per user. */
export const totpLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 5 * 60 * 1000, blockMs: 5 * 60 * 1000 })

export function buildLoginKey(ip: string, email: string): string {
  return `login:${ip}:${email.toLowerCase()}`
}

export function buildEmailKey(email: string): string {
  return `email:${email.toLowerCase()}`
}

export function buildTotpKey(userId: string): string {
  return `totp:${userId}`
}