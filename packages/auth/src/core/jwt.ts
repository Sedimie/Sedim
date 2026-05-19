// src/sedim/auth/core/jwt.ts
// ── JWT utilities ───────────────────────────────────────────────
// Optional JWT transport for the auth module.
// Uses the signed-session approach: JWTs are cryptographically signed
// but NOT self-contained (claims are verified against DB for sensitive ops).
//
// Why not pure stateless JWTs?
//   - Stateless JWTs can't be revoked without a blocklist.
//   - If you need instant logout across devices, you need DB-backed tokens.
//   - This module uses a hybrid: short-lived JWTs for stateless API calls,
//     with session tokens (DB-backed) for full auth state.
//
// Token types:
//   access_token  — JWT, short-lived (15 min), carries userId + sessionId
//   refresh_token — opaque random string, stored in DB, long-lived (30 days)
//
// This means:
//   ✅ JWTs work for stateless API auth without DB roundtrips
//   ✅ Refresh tokens can be revoked instantly (DB delete)
//   ✅ Compromised JWTs expire automatically in 15 minutes
//   ✅ Full session revocation works via the sessions table

import { encodeBase32LowerCaseNoPadding, decodeBase32LowerCaseNoPadding } from '@oslojs/encoding'
import { createHMAC } from '@oslojs/crypto'

// ── Token shapes ────────────────────────────────────────────────

export interface JwtAccessToken {
  sub: string          // userId
  sid: string         // sessionId
  iat: number         // issued at (unix ms)
  exp: number         // expires at (unix ms)
  jti: string         // unique token id (for replay prevention)
}

export interface RefreshTokenRecord {
  id: string          // hashed token, used as lookup key
  userId: string
  sessionId: string
  expiresAt: Date
  createdAt: Date
}

// ── Constants ────────────────────────────────────────────────────

export const ACCESS_TOKEN_TTL_MS = 1000 * 60 * 15    // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30  // 30 days

// ── Access token ─────────────────────────────────────────────────

/**
 * Creates a signed JWT access token.
 * The signature uses HMAC-SHA256 with AUTH_SECRET.
 * Claims are NOT encrypted — don't put sensitive data in the payload.
 */
export function createAccessToken(
  userId: string,
  sessionId: string,
  secret: string,
): string {
  const now = Date.now()
  const jti = encodeBase32LowerCaseNoPadding(crypto.getRandomValues(new Uint8Array(16)))
  const payload: JwtAccessToken = {
    sub: userId,
    sid: sessionId,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_MS,
    jti,
  }

  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64urlEncode(JSON.stringify(payload))
  const sig = hmacSign(`${header}.${body}`, secret)

  return `${header}.${body}.${sig}`
}

/**
 * Verifies and decodes a JWT access token.
 * Returns null if expired, tampered, or invalid.
 */
export function verifyAccessToken(
  raw: string,
  secret: string,
): JwtAccessToken | null {
  const parts = raw.split('.')
  if (parts.length !== 3) return null

  const [header, body, sig] = parts
  const expectedSig = hmacSign(`${header}.${body}`, secret)
  if (!timingSafeEquals(sig, expectedSig)) return null

  let payload: JwtAccessToken
  try {
    payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }

  if (payload.exp < Date.now()) return null

  return payload
}

// ── Refresh token ────────────────────────────────────────────────

/**
 * Creates a raw refresh token (random bytes, base32 encoded).
 * The hash of this token is stored in the DB.
 * Returns { raw, record } — store 'raw' in an httpOnly cookie.
 */
export function createRefreshToken(
  userId: string,
  sessionId: string,
): { raw: string; record: RefreshTokenRecord } {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = encodeBase32LowerCaseNoPadding(bytes)
  const id = hashRefreshToken(raw)

  return {
    raw,
    record: {
      id,
      userId,
      sessionId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      createdAt: new Date(),
    },
  }
}

/**
 * Hashes a refresh token for DB storage (never store the raw token).
 */
export function hashRefreshToken(rawToken: string): string {
  return createHMAC(rawToken, new TextEncoder().encode('refresh-token-v1'))
}

// ── Low-level helpers ───────────────────────────────────────────

function base64urlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function hmacSign(msg: string, secret: string): string {
  const sig = createHMAC(msg, new TextEncoder().encode(secret))
  return base64urlEncode(String.fromCharCode(...sig))
}

function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}