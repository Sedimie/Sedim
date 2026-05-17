import type { DatabaseAdapter } from '../types.js'

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
}

export interface OAuthProfile {
  providerUserId: string
  email: string
  emailVerified: boolean
}

// ── Built-in provider presets ─────────────────────────────────
// Users pass clientId + clientSecret — everything else is pre-configured.

export function googleProvider(clientId: string, clientSecret: string): OAuthProviderConfig {
  return {
    providerId: 'google',
    clientId,
    clientSecret,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
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
}

export interface ResolvedAuthConfig extends Required<AuthConfig> {
  providerMap: Map<string, OAuthProviderConfig>
}

export function resolveConfig(config: AuthConfig): ResolvedAuthConfig {
  const providers = config.providers ?? []
  return {
    ...config,
    providers,
    providerMap: new Map(providers.map(p => [p.providerId, p])),
    cookieName: config.cookieName ?? 'auth_session',
    secureCookies: config.secureCookies ?? process.env['NODE_ENV'] === 'production',
    basePath: config.basePath ?? '/auth',
  }
}
