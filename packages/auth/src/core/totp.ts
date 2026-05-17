import { HMAC } from '@oslojs/crypto/hmac'
import { SHA1 } from '@oslojs/crypto/sha1'
import { encodeBase32UpperCaseNoPadding, decodeBase32IgnorePadding } from '@oslojs/encoding'

// RFC 6238 TOTP / RFC 4226 HOTP
const TOTP_PERIOD = 30
const TOTP_DIGITS = 6
const TOTP_WINDOW = 1 // ±1 step to handle clock drift

/** Generates a new TOTP secret. Store in DB, encode into QR code URI via buildTotpUri. */
export function generateTotpSecret(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return encodeBase32UpperCaseNoPadding(bytes)
}

/** Generates the current TOTP code for a secret. Useful for testing. */
export function generateTotpCode(secret: string, timestamp = Date.now()): string {
  const secretBytes = decodeBase32IgnorePadding(secret)
  const counter = Math.floor(timestamp / 1000 / TOTP_PERIOD)
  return hotp(secretBytes, counter)
}

/**
 * Verifies a TOTP code. Checks ±1 window for clock drift.
 *
 * On success, store usedCounter and reject future codes where counter <= usedCounter.
 * This prevents replay attacks within the drift window.
 */
export function verifyTotpCode(
  secret: string,
  code: string,
  timestamp = Date.now(),
): { valid: boolean; usedCounter: number | null } {
  const secretBytes = decodeBase32IgnorePadding(secret)
  const currentCounter = Math.floor(timestamp / 1000 / TOTP_PERIOD)

  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const counter = currentCounter + delta
    if (timingSafeEqual(code, hotp(secretBytes, counter))) {
      return { valid: true, usedCounter: counter }
    }
  }

  return { valid: false, usedCounter: null }
}

/**
 * Builds an otpauth:// URI for QR code generation.
 * Pass the result to a QR library (e.g. `qrcode`) to render the setup screen.
 */
export function buildTotpUri(secret: string, account: string, issuer: string): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD),
  })
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params}`
}

function hotp(secret: Uint8Array, counter: number): string {
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setUint32(0, Math.floor(counter / 0x100000000), false)
  view.setUint32(4, counter >>> 0, false)

  const mac = new HMAC(SHA1, secret)
  mac.update(new Uint8Array(buf))
  const digest = mac.digest()

  const offset = digest[digest.length - 1]! & 0x0f
  const code =
    (((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff)) %
    10 ** TOTP_DIGITS

  return code.toString().padStart(TOTP_DIGITS, '0')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  let result = 0
  for (let i = 0; i < aBytes.length; i++) {
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)
  }
  return result === 0
}
