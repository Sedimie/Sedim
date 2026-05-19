// src/sedim/auth/core/totp-crypto.ts
// ── TOTP secret encryption at rest ──────────────────────────────
// TOTP secrets are encrypted with AES-256-GCM before being stored in the DB.
// This uses Node.js built-in `crypto` module — no extra dependencies needed.
//
// Why AES-GCM?
//   - Authenticated encryption — detects both tampering and decryption failures
//   - Random 96-bit nonce per encryption — no nonce reuse risk
//   - 128-bit authentication tag — any tampering is detected
//
// Production note: If your DB is on a different host than your app server,
// consider using a key management service (AWS KMS, GCP Secret Manager) to
// store the master encryption key rather than deriving it from AUTH_SECRET.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// ── Key derivation ──────────────────────────────────────────────

const TOTP_KEY_INFO = 'sedim-totp-encryption-v1'

/**
 * Derives a 256-bit encryption key from AUTH_SECRET.
 * Uses SHA-256 to derive a fixed-length key from the secret.
 */
function deriveTotpKey(authSecret: string): Buffer {
  return Buffer.from(
    // SHA-256 of the secret + info string, hex-encoded, then first 32 bytes
    // We use HMAC-SHA256 since @oslojs/crypto is already a dependency
    require('crypto')
      .createHmac('sha256', Buffer.from(authSecret, 'utf8'))
      .update(TOTP_KEY_INFO)
      .digest()
      .slice(0, 32)
  )
}

// ── Encryption / Decryption ──────────────────────────────────────

/**
 * Encrypts a TOTP secret before storing in the DB.
 * Uses AES-256-GCM with a random 96-bit nonce per call.
 * Output format: `nonce:tag:ciphertext` — all base64url encoded.
 *
 * @param secret     — base32-encoded TOTP secret (from generateTotpSecret)
 * @param authSecret — the AUTH_SECRET env var value
 * @returns encrypted string suitable for DB storage
 */
export function encryptTotpSecret(secret: string, authSecret: string): string {
  const key = deriveTotpKey(authSecret)
  const nonce = randomBytes(12) // 96-bit nonce for GCM
  const cipher = createCipheriv('aes-256-gcm', key, nonce)

  const plaintext = Buffer.from(secret, 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  // Format: nonce:tag:ciphertext (all base64url)
  return [
    base64urlEncode(nonce),
    base64urlEncode(tag),
    base64urlEncode(ciphertext),
  ].join(':')
}

/**
 * Decrypts a TOTP secret from the DB.
 * Returns null if tampered or wrong key.
 *
 * @param encrypted  — string from encryptTotpSecret
 * @param authSecret — the AUTH_SECRET env var value
 * @returns base32-encoded TOTP secret, or null if invalid
 */
export function decryptTotpSecret(encrypted: string, authSecret: string): string | null {
  const parts = encrypted.split(':')
  if (parts.length !== 3) return null

  let nonce: Buffer, tag: Buffer, ciphertext: Buffer
  try {
    nonce = base64urlDecode(parts[0])
    tag = base64urlDecode(parts[1])
    ciphertext = base64urlDecode(parts[2])
  } catch {
    return null
  }

  if (nonce.length !== 12 || tag.length !== 16) return null

  const key = deriveTotpKey(authSecret)
  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)

  let plaintext: Buffer
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    return null // authentication failed — tampered or wrong key
  }

  return plaintext.toString('utf8')
}

// ── Helpers ─────────────────────────────────────────────────────

function base64urlEncode(data: Buffer): string {
  return data.toString('base64url')
}

function base64urlDecode(str: string): Buffer {
  // base64url uses - instead of + and _ instead of /
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64')
}
