import type { DatabaseAdapter } from '../types.js'
import type { EmailTransportConfig } from '../../core/email-transport.js'
import { type RateLimitStore, InMemoryRateLimitStore } from '../../core/rate-limit-store.js'

// ── OAuth provider config ─────────────────────────────────────

export interface OAuthProviderConfig {
  providerId: string
  clientId: string
  clientSecret: string
  authorizationUrl: string
  tokenUrl: string
  userinfoUrl: string
  scopes: string[]
  /** Maps the provider's userinfo response to a normalized profile. */
  mapProfile: (profile: Record<string, unknown>) => OAuthProfile
  /**
   * OIDC discovery URL (e.g. 'https://accounts.google.com/.well-known/openid-configuration').
   * If provided, the module will validate id_token and use OIDC claims.
   * Implies openid scope if not already present.
   */
  discoveryUrl?: string
  /**
   * For OIDC: the OAuth 2.0 client ID must match the id_token `aud`/`azp` claim.
   * Auto-populated from clientId if not set.
   */
  oidcClientId?: string
}

export interface OAuthProfile {
  providerUserId: string
  email: string
  emailVerified: boolean
}

// ── Built-in provider presets ─────────────────────────────────
// Users pass clientId + clientSecret — everything else is pre-configured.

export interface GoogleOIDCOptions {
  /** Enable OIDC by providing the discovery URL. */
  discoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration'
  /** Optional — defaults to clientId. */
  oidcClientId?: string
}

export function googleProvider(
  clientId: string,
  clientSecret: string,
  options?: GoogleOIDCOptions,
): OAuthProviderConfig {
  return {
    providerId: 'google',
    clientId,
    clientSecret,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
    ...(options?.discoveryUrl ? { discoveryUrl: options.discoveryUrl, oidcClientId: options.oidcClientId ?? clientId } : {}),
    mapProfile(profile) {
      return {
        providerUserId: String(profile['sub']),
        email: String(profile['email']),
        emailVerified: Boolean(profile['email_verified']),
      }
    },
  }
}

export function githubProvider(clientId: string, clientSecret: string): OAuthProviderConfig {
  return {
    providerId: 'github',
    clientId,
    clientSecret,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userinfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    mapProfile(profile) {
      return {
        providerUserId: String(profile['id']),
        email: String(profile['email']),
        emailVerified: true, // GitHub verifies emails
      }
    },
  }
}

export function discordProvider(clientId: string, clientSecret: string): OAuthProviderConfig {
  return {
    providerId: 'discord',
    clientId,
    clientSecret,
    authorizationUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userinfoUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email'],
    mapProfile(profile) {
      return {
        providerUserId: String(profile['id']),
        email: String(profile['email']),
        emailVerified: Boolean(profile['verified']),
      }
    },
  }
}

// ── Auth config ───────────────────────────────────────────────

export interface AuthConfig {
  db: DatabaseAdapter
  /** AUTH_SECRET env var — used to sign state params. Min 32 chars. */
  secret: string
  providers?: OAuthProviderConfig[]
  cookieName?: string
  /** Defaults to true in production (process.env.NODE_ENV === 'production'). */
  secureCookies?: boolean
  /** Base path for auth routes. Defaults to '/auth'. */
  basePath?: string
  /**
   * Rate limiter store. Defaults to in-memory Map (single-process).
   * Pass `new RedisRateLimitStore(redisClient)` for multi-instance prod.
   */
  rateLimiter?: { store?: RateLimitStore }
  /**
   * Email transport configuration. Defaults to nodemailer with env var SMTP_*.
   *   { transport: 'resend', resend: { apiKey: 're_xxx' } }
   *   { transport: 'postmark', postmark: { apiKey: 'xxx' } }
   *   { transport: 'ses', ses: { region: 'us-east-1', from: 'noreply@domain.com' } }
   *   { transport: 'nodemailer', smtp: { host, port, user, pass, from } }
   */
  email?: EmailTransportConfig
}

export interface ResolvedAuthConfig {
  db: DatabaseAdapter
  secret: string
  providers: OAuthProviderConfig[]
  cookieName: string
  secureCookies: boolean
  basePath: string
  providerMap: Map<string, OAuthProviderConfig>
  rateLimiter: { store: RateLimitStore }
  email: EmailTransportConfig
}

export function resolveConfig(config: AuthConfig): ResolvedAuthConfig {
  const providers = config.providers ?? []
  const store = config.rateLimiter?.store ?? new InMemoryRateLimitStore()
  return {
    ...config,
    providers,
    providerMap: new Map(providers.map(p => [p.providerId, p])),
    cookieName: config.cookieName ?? 'auth_session',
    secureCookies: config.secureCookies ?? process.env['NODE_ENV'] === 'production',
    basePath: config.basePath ?? '/auth',
    rateLimiter: { store },
    email: config.email ?? { transport: 'nodemailer' as const, smtp: { host: process.env.SMTP_HOST!, port: parseInt(process.env.SMTP_PORT ?? '587'), user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS!, from: process.env.SMTP_FROM ?? 'Sedim <noreply@sedim.dev>' } },
  }
}
