import { sha256 } from '@oslojs/crypto/sha2'
import { encodeBase64urlNoPadding } from '@oslojs/encoding'
import { generateCodeVerifier } from './generate-token.js'

// RFC 7636 — S256 method only. "plain" provides no security benefit.

/** Derives the PKCE code_challenge from a verifier. BASE64URL(SHA256(verifier)). */
export function deriveCodeChallenge(codeVerifier: string): string {
  const hash = sha256(new TextEncoder().encode(codeVerifier))
  return encodeBase64urlNoPadding(hash)
}

/**
 * Generates a PKCE verifier + challenge pair.
 * Store the verifier server-side, send the challenge in the authorization URL.
 */
export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = deriveCodeChallenge(codeVerifier)
  return { codeVerifier, codeChallenge }
}

/**
 * Builds an OAuth 2.0 authorization URL with PKCE.
 * Called by framework adapters when starting an OAuth flow.
 */
export function buildAuthorizationUrl(
  baseUrl: string,
  params: {
    clientId: string
    redirectUri: string
    scope: string[]
    state: string
    codeChallenge: string
  },
): URL {
  const url = new URL(baseUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('scope', params.scope.join(' '))
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url
}
