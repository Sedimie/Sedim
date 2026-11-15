import { generatePkcePair, buildAuthorizationUrl } from '../../../core/pkce.js'
import { generateOtpToken, generateSessionToken, hashSessionToken } from '../../../core/generate-token.js'
import { buildSession } from '../../../core/session.js'
import type { DatabaseAdapter, User } from '../../types.js'
import type { Session } from '../../../core/session.js'
import type { ResolvedAuthConfig, OAuthProfile } from '../framework-config.js'
import type { AuthResult } from './core.js'

// ── OAuth operations ──────────────────────────────────────────

export function createOAuthRedirect(
  config: ResolvedAuthConfig,
  providerId: string,
): AuthResult<{ url: URL; codeVerifier: string; state: string }> {
  const provider = config.providerMap.get(providerId)
  if (!provider) return { ok: false, error: 'oauth-provider-unknown' }

  const { codeVerifier, codeChallenge } = generatePkcePair()
  const state = generateOtpToken()

  const url = buildAuthorizationUrl(provider.authorizationUrl, {
    clientId: provider.clientId,
    redirectUri: `${config.basePath}/oauth/${providerId}/callback`,
    scope: provider.scopes,
    state,
    codeChallenge,
  })

  return { ok: true, data: { url, codeVerifier, state } }
}

export async function handleOAuthCallback(
  db: DatabaseAdapter,
  config: ResolvedAuthConfig,
  providerId: string,
  code: string,
  codeVerifier: string,
): Promise<AuthResult<{ user: User; token: string; session: Session }>> {
  const provider = config.providerMap.get(providerId)
  if (!provider) return { ok: false, error: 'oauth-provider-unknown' }

  const isOIDC = Boolean(provider.discoveryUrl)

  // exchange code for access token (+ id_token if OIDC)
  let accessToken: string
  let idToken: string | undefined
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${config.basePath}/oauth/${providerId}/callback`,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: codeVerifier,
    })

    const res = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params,
    })

    if (!res.ok) return { ok: false, error: 'oauth-exchange-failed' }
    const data = (await res.json()) as Record<string, unknown>
    accessToken = String(data['access_token'])
    if (isOIDC) idToken = String(data['id_token'] ?? '')
  } catch {
    return { ok: false, error: 'oauth-exchange-failed' }
  }

  // ── OIDC path: validate id_token, extract claims ───────────────
  if (isOIDC && idToken && provider.discoveryUrl) {
    const { validateIdToken, extractEmailFromClaims } = await import('../../../core/oidc.js')
    const clientId = provider.oidcClientId ?? provider.clientId

    let claims: Awaited<ReturnType<typeof validateIdToken>>
    try {
      claims = await validateIdToken(idToken, provider.discoveryUrl, clientId)
    } catch {
      return { ok: false, error: 'oauth-exchange-failed' }
    }

    const emailData = extractEmailFromClaims(claims)
    const email = emailData?.email ?? String(claims.sub)
    const emailVerified = emailData?.emailVerified ?? false

    // find or create user using OIDC claims
    let user: User
    const existingAccount = await db.findOAuthAccount(providerId, String(claims.sub))

    if (existingAccount) {
      const found = await db.findUserById(existingAccount.userId)
      if (!found) return { ok: false, error: 'user-not-found' }
      user = found
    } else {
      const existingUser = await db.findUserByEmail(email)
      if (existingUser) {
        user = existingUser
      } else {
        user = await db.createUser({ email, passwordHash: null })
        if (emailVerified) await db.updateUser(user.id, { emailVerified: true })
      }
      await db.createOAuthAccount({
        providerId,
        providerUserId: String(claims.sub),
        userId: user.id,
      })
    }

    const sessionToken = generateSessionToken()
    const session = buildSession(hashSessionToken(sessionToken), user.id)
    await db.createSession(session)

    return { ok: true, data: { user, token: sessionToken, session } }
  }

  // ── vanilla OAuth path: use userinfo endpoint ────────────────────
  let profile: OAuthProfile
  try {
    const res = await fetch(provider.userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return { ok: false, error: 'oauth-exchange-failed' }
    const raw = (await res.json()) as Record<string, unknown>
    profile = provider.mapProfile(raw)
  } catch {
    return { ok: false, error: 'oauth-exchange-failed' }
  }

  // find or create user
  let user: User
  const existingAccount = await db.findOAuthAccount(providerId, profile.providerUserId)

  if (existingAccount) {
    const found = await db.findUserById(existingAccount.userId)
    if (!found) return { ok: false, error: 'user-not-found' }
    user = found
  } else {
    // check if email already exists — link accounts
    const existingUser = await db.findUserByEmail(profile.email)
    if (existingUser) {
      user = existingUser
    } else {
      user = await db.createUser({ email: profile.email, passwordHash: null })
      if (profile.emailVerified) {
        await db.updateUser(user.id, { emailVerified: true })
      }
    }
    await db.createOAuthAccount({
      providerId,
      providerUserId: profile.providerUserId,
      userId: user.id,
    })
  }

  const sessionToken = generateSessionToken()
  const session = buildSession(hashSessionToken(sessionToken), user.id)
  await db.createSession(session)

  return { ok: true, data: { user, token: sessionToken, session } }
}
