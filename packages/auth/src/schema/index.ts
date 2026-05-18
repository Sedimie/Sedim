// Drizzle schemas — plan-config.ts stamps the correct one based on ctx.db.value
export { authSchema as drizzlePgSchema } from './drizzle.js'
export { authSchema as drizzleMysqlSchema } from './drizzle-mysql.js'
export { authSchema as drizzleSqliteSchema } from './drizzle-sqlite.js'

// Individual table exports for partial installs (existing users table scenario)
export { users, sessions, otpTokens, oauthAccounts, totpCredentials, backupCodes } from './drizzle.js'

// ── Feature-driven table selection ────────────────────────────
// Single source of truth for which tables each feature requires.
// Used by plan-config.ts to compute schemaTables for the thinker,
// and by the CLI to determine which schema files to stamp.

export type AuthFeature =
  | 'email-password'
  | 'magic-link'
  | 'email-verification'
  | 'oauth'
  | 'totp'
  | 'password-reset'

/**
 * Returns the DB table names required for a given set of selected features.
 * plan-config.ts passes selectedFeatures here to get the minimal table set.
 *
 * email-password only → ['users', 'sessions']
 * + magic-link        → + ['otp_tokens']
 * + oauth             → + ['oauth_accounts']
 * + totp              → + ['totp_credentials', 'backup_codes']
 */
export function getRequiredTables(features: AuthFeature[]): string[] {
  const required = new Set(['users', 'sessions'])

  for (const feature of features) {
    switch (feature) {
      case 'magic-link':
      case 'email-verification':
      case 'password-reset':
        required.add('otp_tokens')
        break
      case 'oauth':
        required.add('oauth_accounts')
        break
      case 'totp':
        required.add('totp_credentials')
        required.add('backup_codes')
        break
      case 'email-password':
        break
    }
  }

  return [...required]
}

/**
 * Returns the Drizzle schema object filtered to only the tables needed
 * for the selected features. Pass this to createDrizzleAdapter.
 */
export function getDrizzleSchemaForFeatures(
  features: AuthFeature[],
  fullSchema: Record<string, unknown>,
): Record<string, unknown> {
  const tables = getRequiredTables(features)
  const tableKeyMap: Record<string, string> = {
    users: 'users',
    sessions: 'sessions',
    otp_tokens: 'otpTokens',
    oauth_accounts: 'oauthAccounts',
    totp_credentials: 'totpCredentials',
    backup_codes: 'backupCodes',
  }
  return Object.fromEntries(
    tables
      .map(t => tableKeyMap[t])
      .filter((k): k is string => Boolean(k))
      .map(key => [key, fullSchema[key]])
  )
}
