import { createAccessToken, hashRefreshToken, ACCESS_TOKEN_TTL_MS } from '../../../core/jwt.js'
import type { DatabaseAdapter } from '../../types.js'
import type { AuthResult } from './core.js'

// ── JWT refresh ─────────────────────────────────────────────────

export async function refreshAccessToken(
  db: DatabaseAdapter,
  rawRefreshToken: string,
  authSecret: string,
): Promise<AuthResult<{ accessToken: string; expiresAt: Date }>> {
  const tokenHash = hashRefreshToken(rawRefreshToken)
  const record = await db.findRefreshToken(tokenHash)
  if (!record) return { ok: false, error: 'token-invalid' }
  if (record.expiresAt < new Date()) {
    await db.deleteRefreshToken(tokenHash)
    return { ok: false, error: 'token-expired' }
  }

  // verify the session still exists and is valid
  const session = await db.findSession(record.sessionId)
  if (!session || session.expiresAt < new Date()) {
    await db.deleteRefreshToken(tokenHash)
    return { ok: false, error: 'token-invalid' }
  }

  const accessToken = createAccessToken(record.userId, record.sessionId, authSecret)
  return { ok: true, data: { accessToken, expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS) } }
}

export async function revokeRefreshToken(
  db: DatabaseAdapter,
  rawRefreshToken: string,
): Promise<void> {
  await db.deleteRefreshToken(hashRefreshToken(rawRefreshToken))
}
