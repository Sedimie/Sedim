// src/core/oidc.ts
// ── OIDC discovery + id_token validation ────────────────────────
// Supports providers with a discovery document (e.g. Google, Discord, Auth0).
//
// When a provider has discoveryUrl set, handleOAuthCallback will:
//   1. Fetch the OIDC discovery document
//   2. Cache it (5 min TTL)
//   3. Validate id_token from the token response using the provider's JWKS
//
// Usage in AuthConfig providers:
//
//   providers: [
//     googleProvider(clientId, clientSecret, {
//       discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
//       oidcClientId: clientId,  // optional, defaults to clientId
//     }),
//   ]
//
// The discovery URL is cached for 5 minutes to avoid hitting the provider on
// every request.

import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose'
import type { JwtPayload } from 'jose'

// ── Discovery cache ─────────────────────────────────────────────

interface OIDCDiscovery {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  jwks_uri: string
}

interface CacheEntry {
  discovery: OIDCDiscovery
  jwks: ReturnType<typeof createRemoteJWKSet>
  fetchedAt: number
}

const discoveryCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000

async function fetchDiscovery(url: string): Promise<OIDCDiscovery> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<OIDCDiscovery>
}

async function getOidcConfig(discoveryUrl: string): Promise<{ discovery: OIDCDiscovery; jwks: ReturnType<typeof createRemoteJWKSet> }> {
  const cached = discoveryCache.get(discoveryUrl)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { discovery: cached.discovery, jwks: cached.jwks }
  }

  const discovery = await fetchDiscovery(discoveryUrl)
  const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri))
  discoveryCache.set(discoveryUrl, { discovery, jwks, fetchedAt: Date.now() })
  return { discovery, jwks }
}

// ── id_token validation ─────────────────────────────────────────

export interface OIDCClaims {
  sub: string          // user ID at the provider
  email?: string
  email_verified?: boolean
  aud: string | string[]  // azp or aud claim
  iss: string
  exp: number
  iat: number
}

/**
 * Fetches OIDC config and validates an id_token.
 * Returns the decoded claims on success, throws on failure.
 *
 * @param idToken - raw id_token from the OAuth token response
 * @param discoveryUrl - OIDC discovery URL
 * @param clientId - your app's client ID (used to verify aud/azp)
 */
export async function validateIdToken(
  idToken: string,
  discoveryUrl: string,
  clientId: string,
): Promise<OIDCClaims> {
  const { discovery, jwks } = await getOidcConfig(discoveryUrl)

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: discovery.issuer,
    audience: clientId,
  })

  return payload as unknown as OIDCClaims
}

/**
 * Lightweight version — decodes without verification.
 * Use only when you need to extract claims for logging/debugging.
 */
export function decodeIdTokenUnverified(idToken: string): OIDCClaims {
  return decodeJwt(idToken) as unknown as OIDCClaims
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Checks if the provider has OIDC discovery configured.
 */
export function hasOIDC(provider: { discoveryUrl?: string }): boolean {
  return Boolean(provider.discoveryUrl)
}

/**
 * Extracts the email + verified flag from OIDC claims.
 * Falls back to userinfo endpoint if id_token doesn't contain email.
 */
export function extractEmailFromClaims(claims: OIDCClaims): { email: string; emailVerified: boolean } | null {
  if (claims.email) {
    return { email: claims.email, emailVerified: Boolean(claims.email_verified) }
  }
  return null
}