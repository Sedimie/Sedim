export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export interface Session {
  /** SHA-256 hash of the raw token. DB primary key. */
  id: string
  userId: string
  expiresAt: Date
  fresh: boolean
}

export interface SessionValidationResult {
  session: Session
  /** True if expiresAt was extended — persist the new value to the DB. */
  extended: boolean
}

/** Builds a new session object. Does not persist — call DatabaseAdapter.createSession after. */
export function buildSession(tokenHash: string, userId: string): Session {
  return {
    id: tokenHash,
    userId,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    fresh: true,
  }
}

/**
 * Validates a session from the DB.
 * Returns null if expired (delete it).
 * Returns { extended: true } if past the halfway point — persist the new expiresAt.
 * Returns { extended: false } if still fresh.
 */
export function validateSession(session: Session): SessionValidationResult | null {
  const now = Date.now()

  if (now >= session.expiresAt.getTime()) return null

  const halfwayPoint = session.expiresAt.getTime() - SESSION_DURATION_MS / 2
  if (now >= halfwayPoint) {
    return {
      session: { ...session, expiresAt: new Date(now + SESSION_DURATION_MS), fresh: false },
      extended: true,
    }
  }

  return { session, extended: false }
}
