import type { DetectedContext, PlanConfig } from '@sedim/core'
import { getRequiredTables } from './schema/index.js'
import type { AuthFeature } from './schema/index.js'

// ── Auth PlanConfig ───────────────────────────────────────────
// This is what the CLI thinker consumes to build an InstallPlan.
// It replaces the generic manifestToPlanConfig for the auth module.
//
// Called by: sedim add auth (via the add command's plan-config loader)
// Receives:  DetectedContext (what the detector found) + selectedFeatures
// Returns:   PlanConfig (what to stamp, inject, install, and configure)

export function createAuthPlanConfig(
  ctx: DetectedContext,
  selectedFeatures: string[],
): PlanConfig {
  const src = ctx.structure.srcDir ?? 'src'
  const framework = ctx.framework.value
  const orm = ctx.orm.value
  const features = selectedFeatures as AuthFeature[]

  // ── unsupported stack — surface clearly rather than silently failing ──
  const unsupportedReasons: string[] = []
  if (framework === 'fastify') unsupportedReasons.push('Fastify adapter not yet supported — coming in v1.1')
  if (framework === 'unknown') unsupportedReasons.push('Framework could not be detected. Run sedim init first.')
  if (orm === 'none') unsupportedReasons.push('No ORM detected. Auth requires Drizzle or Prisma.')
  if (orm === 'unknown') unsupportedReasons.push('ORM could not be detected. Run sedim init first.')
  if (orm !== 'drizzle' && orm !== 'prisma') unsupportedReasons.push(`ORM "${orm}" is not supported yet. Use Drizzle or Prisma.`)

  // ── schema tables — only what selected features actually need ─────────
  const schemaTables = getRequiredTables(features)

  // ── template keys and output paths ───────────────────────────────────
  // templateKey maps to a file in packages/auth/src/templates/
  // outputPath is where it lands in the user's project

  const templates: PlanConfig['templates'] = []

  // auth config — always stamped, framework-specific
  templates.push({
    templateKey: `auth/config/${framework}`,
    outputPath: () => `${src}/lib/auth.ts`,
    overwriteStrategy: 'ask',
  })

  // schema — ORM and DB dialect specific
  if (orm === 'drizzle') {
    const db = ctx.db.value
    const dialect = db === 'mysql' ? 'mysql' : db === 'sqlite' ? 'sqlite' : 'pg'
    templates.push({
      templateKey: `auth/schema/drizzle-${dialect}`,
      outputPath: () => `${src}/db/schema/auth.ts`,
      overwriteStrategy: 'ask',
    })
  } else if (orm === 'prisma') {
    // prisma stamps model blocks — handled as injection into schema.prisma
    // base models always needed
    templates.push({
      templateKey: 'auth/schema/prisma-base',
      outputPath: () => 'prisma/auth.prisma',
      overwriteStrategy: 'ask',
    })
    if (features.some(f => ['magic-link', 'email-verification', 'password-reset'].includes(f))) {
      templates.push({
        templateKey: 'auth/schema/prisma-otp',
        outputPath: () => 'prisma/auth-otp.prisma',
        overwriteStrategy: 'ask',
      })
    }
    if (features.includes('oauth-google') || features.includes('oauth-github') || features.includes('oauth-discord')) {
      templates.push({
        templateKey: 'auth/schema/prisma-oauth',
        outputPath: () => 'prisma/auth-oauth.prisma',
        overwriteStrategy: 'ask',
      })
    }
    if (features.includes('totp')) {
      templates.push({
        templateKey: 'auth/schema/prisma-totp',
        outputPath: () => 'prisma/auth-totp.prisma',
        overwriteStrategy: 'ask',
      })
    }
  }

  // Next.js — route handler at app/api/auth/[...all]/route.ts
  if (framework === 'nextjs') {
    templates.push({
      templateKey: 'auth/routes/nextjs',
      outputPath: () => `${src}/app/api/auth/[...all]/route.ts`,
      overwriteStrategy: 'ask',
    })
    // middleware.ts for session-based route protection
    templates.push({
      templateKey: 'auth/middleware/nextjs',
      outputPath: () => 'middleware.ts',
      overwriteStrategy: 'ask',
    })
  }

  // Express — router file
  if (framework === 'express') {
    templates.push({
      templateKey: 'auth/routes/express',
      outputPath: () => `${src}/auth/router.ts`,
      overwriteStrategy: 'ask',
    })
    templates.push({
      templateKey: 'auth/middleware/express',
      outputPath: () => `${src}/auth/middleware.ts`,
      overwriteStrategy: 'ask',
    })
  }

  // Hono — routes file
  if (framework === 'hono') {
    templates.push({
      templateKey: 'auth/routes/hono',
      outputPath: () => `${src}/auth/routes.ts`,
      overwriteStrategy: 'ask',
    })
  }

  // DB adapter wiring file — always stamped, tells user how to wire it up
  templates.push({
    templateKey: `auth/adapter/${orm}`,
    outputPath: () => `${src}/lib/auth-adapter.ts`,
    overwriteStrategy: 'ask',
  })

  // ── injections ────────────────────────────────────────────────────────

  const injections: PlanConfig['injections'] = []

  // Express: inject auth router into the app entry file
  if (framework === 'express') {
    injections.push({
      type: 'route',
      target: (c: DetectedContext) => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        express: {
          payload: `app.use('/auth', authRouter)`,
          anchor: `app.listen`,
          position: 'before',
        },
      },
    })
    injections.push({
      type: 'import',
      target: (c: DetectedContext) => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        express: {
          payload: `import { authRouter } from './auth/router'`,
          anchor: `import`,
          position: 'after',
        },
      },
    })
  }

  // Hono: inject auth routes into the app entry file
  if (framework === 'hono') {
    injections.push({
      type: 'route',
      target: (c: DetectedContext) => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        hono: {
          payload: `app.route('/auth', authRoutes)`,
          anchor: `export default`,
          position: 'before',
        },
      },
    })
    injections.push({
      type: 'import',
      target: (c: DetectedContext) => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        hono: {
          payload: `import { authRoutes } from './auth/routes'`,
          anchor: `import`,
          position: 'after',
        },
      },
    })
  }

  // ── dependencies ──────────────────────────────────────────────────────

  const dependencies = [
    'argon2',
    '@oslojs/crypto',
    '@oslojs/encoding',
  ]

  const hasOAuth = features.some(f => f.startsWith('oauth-'))
  if (hasOAuth) dependencies.push('@oslojs/oauth2')

  // ── env vars — filtered by selected features ──────────────────────────

  const envVars: PlanConfig['envVars'] = [
    {
      key: 'AUTH_SECRET',
      description: 'Random secret for signing session tokens. Min 32 characters.',
      example: 'openssl rand -hex 32',
      required: true,
    },
    {
      key: 'APP_URL',
      description: 'Your app public base URL. Used for OAuth redirect URIs and email links.',
      example: 'https://yourdomain.com',
      required: true,
    },
  ]

  if (features.includes('oauth-google')) {
    envVars.push(
      { key: 'GOOGLE_CLIENT_ID', description: 'Google OAuth client ID from console.cloud.google.com', required: true },
      { key: 'GOOGLE_CLIENT_SECRET', description: 'Google OAuth client secret', required: true },
    )
  }
  if (features.includes('oauth-github')) {
    envVars.push(
      { key: 'GITHUB_CLIENT_ID', description: 'GitHub OAuth client ID from github.com/settings/developers', required: true },
      { key: 'GITHUB_CLIENT_SECRET', description: 'GitHub OAuth client secret', required: true },
    )
  }
  if (features.includes('oauth-discord')) {
    envVars.push(
      { key: 'DISCORD_CLIENT_ID', description: 'Discord OAuth client ID from discord.com/developers', required: true },
      { key: 'DISCORD_CLIENT_SECRET', description: 'Discord OAuth client secret', required: true },
    )
  }
  if (features.includes('magic-link') || features.includes('email-password')) {
    envVars.push(
      { key: 'SMTP_HOST', description: 'SMTP server hostname (e.g. smtp.resend.com)', required: true },
      { key: 'SMTP_PORT', description: 'SMTP port — 587 for TLS, 465 for SSL', example: '587', required: true },
      { key: 'SMTP_USER', description: 'SMTP username', required: true },
      { key: 'SMTP_PASS', description: 'SMTP password or API key', required: true },
      { key: 'SMTP_FROM', description: 'From address for auth emails', example: 'auth@yourdomain.com', required: true },
    )
  }

  // ── conflict hints for unsupported stacks ─────────────────────────────

  const peerContracts: PlanConfig['peerContracts'] = []

  return {
    moduleName: 'auth',
    version: '0.1.0',
    templates,
    injections,
    dependencies,
    devDependencies: [],
    envVars,
    schemaTables,
    peerContracts,
    // attach unsupported reasons so the thinker can surface them
    ...(unsupportedReasons.length > 0 ? { _unsupportedReasons: unsupportedReasons } : {}),
  } as PlanConfig
}
