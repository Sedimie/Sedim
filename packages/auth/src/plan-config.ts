import type { DetectedContext, PlanConfig } from '@sedim/core'
import { getRequiredTables } from './schema/index.js'
import type { AuthFeature } from './schema/index.js'

// ── Auth PlanConfig ───────────────────────────────────────────
// Stamping model:
//   - All auth files land under src/sedim/auth/ — user owns them, can edit freely
//   - Minimal injections into existing user files:
//       Next.js: stamp new files only (route handler + middleware) — no existing file touched
//       Express/Hono: one import + one mount line in their entry file
//   - Schema lands at src/sedim/auth/schema.ts — user adds it to their schema barrel
//   - User never has to hunt across their project to find auth code

export function createAuthPlanConfig(
  ctx: DetectedContext,
  selectedFeatures: string[],
): PlanConfig {
  const src = ctx.structure.srcDir ?? 'src'
  const authDir = `${src}/sedim/auth`
  const framework = ctx.framework.value
  const orm = ctx.orm.value
  const features = selectedFeatures as AuthFeature[]

  // ── unsupported stack — surface clearly ───────────────────
  const unsupportedReasons: string[] = []
  if (ctx.language.value === 'javascript') {
    unsupportedReasons.push('JavaScript-only projects are not yet supported. Auth requires TypeScript.')
  }
  if (framework === 'fastify') unsupportedReasons.push('Fastify adapter not yet supported — coming in v1.1')
  if (framework === 'unknown') unsupportedReasons.push('Framework could not be detected. Run sedim init first.')
  if (orm === 'none') unsupportedReasons.push('No ORM detected. Auth requires Drizzle or Prisma.')
  if (orm === 'unknown') unsupportedReasons.push('ORM could not be detected. Run sedim init first.')
  if (orm !== 'drizzle' && orm !== 'prisma') {
    unsupportedReasons.push(`ORM "${orm}" is not supported yet. Use Drizzle or Prisma.`)
  }

  // ── schema tables — only what selected features need ──────
  const schemaTables = getRequiredTables(features)

  // ── templates — all land under src/sedim/auth/ ────────────
  const templates: PlanConfig['templates'] = []

  // core logic files — always stamped
  templates.push({
    templateKey: 'auth/core/hash-password',
    outputPath: () => `${authDir}/core/hash-password.ts`,
    overwriteStrategy: 'skip', // never overwrite — user may have customised
  })
  templates.push({
    templateKey: 'auth/core/generate-token',
    outputPath: () => `${authDir}/core/generate-token.ts`,
    overwriteStrategy: 'skip',
  })
  templates.push({
    templateKey: 'auth/core/session',
    outputPath: () => `${authDir}/core/session.ts`,
    overwriteStrategy: 'skip',
  })
  if (features.some(f => f.startsWith('oauth-'))) {
    templates.push({
      templateKey: 'auth/core/pkce',
      outputPath: () => `${authDir}/core/pkce.ts`,
      overwriteStrategy: 'skip',
    })
  }
  if (features.includes('totp')) {
    templates.push({
      templateKey: 'auth/core/totp',
      outputPath: () => `${authDir}/core/totp.ts`,
      overwriteStrategy: 'skip',
    })
  }

  // adapter types — always stamped
  templates.push({
    templateKey: 'auth/adapters/types',
    outputPath: () => `${authDir}/adapters/types.ts`,
    overwriteStrategy: 'skip',
  })

  // ORM adapter
  if (orm === 'drizzle') {
    templates.push({
      templateKey: 'auth/adapters/drizzle',
      outputPath: () => `${authDir}/adapters/drizzle.ts`,
      overwriteStrategy: 'skip',
    })
  } else if (orm === 'prisma') {
    templates.push({
      templateKey: 'auth/adapters/prisma',
      outputPath: () => `${authDir}/adapters/prisma.ts`,
      overwriteStrategy: 'skip',
    })
  }

  // schema — lands in sedim/auth, not in user's db/schema
  if (orm === 'drizzle') {
    const db = ctx.db.value
    const dialect = db === 'mysql' ? 'mysql' : db === 'sqlite' ? 'sqlite' : 'pg'
    const schemaKey = dialect === 'pg' ? 'auth/schema/drizzle' : `auth/schema/drizzle-${dialect}`
    templates.push({
      templateKey: schemaKey,
      outputPath: () => `${authDir}/schema.ts`,
      overwriteStrategy: 'skip',
    })
  } else if (orm === 'prisma') {
    templates.push({
      templateKey: 'auth/schema/prisma-base',
      outputPath: () => `${authDir}/schema.prisma`,
      overwriteStrategy: 'skip',
    })
    if (features.some(f => ['magic-link', 'email-verification', 'password-reset'].includes(f))) {
      templates.push({
        templateKey: 'auth/schema/prisma-otp',
        outputPath: () => `${authDir}/schema-otp.prisma`,
        overwriteStrategy: 'skip',
      })
    }
    if (features.some(f => f.startsWith('oauth-'))) {
      templates.push({
        templateKey: 'auth/schema/prisma-oauth',
        outputPath: () => `${authDir}/schema-oauth.prisma`,
        overwriteStrategy: 'skip',
      })
    }
    if (features.includes('totp')) {
      templates.push({
        templateKey: 'auth/schema/prisma-totp',
        outputPath: () => `${authDir}/schema-totp.prisma`,
        overwriteStrategy: 'skip',
      })
    }
  }

  // framework adapter — stamp the right framework file + its dependencies
  templates.push({
    templateKey: `auth/adapters/framework/${framework}`,
    outputPath: () => `${authDir}/adapters/framework.ts`,
    overwriteStrategy: 'skip',
  })
  // config and operations are imported by the framework adapter — must be stamped too
  templates.push({
    templateKey: 'auth/adapters/framework/framework-config',
    outputPath: () => `${authDir}/adapters/framework-config.ts`,
    overwriteStrategy: 'skip',
  })
  templates.push({
    templateKey: 'auth/adapters/framework/operations',
    outputPath: () => `${authDir}/adapters/operations.ts`,
    overwriteStrategy: 'skip',
  })

  // config file — user edits this to wire their db + providers
  templates.push({
    templateKey: 'auth/templates/config',
    outputPath: () => `${authDir}/config.ts`,
    overwriteStrategy: 'ask',
  })

  // barrel index
  templates.push({
    templateKey: 'auth/templates/index',
    outputPath: () => `${authDir}/index.ts`,
    overwriteStrategy: 'skip',
  })

  // DB adapter wiring file — one level above sedim/auth
  templates.push({
    templateKey: `auth/templates/adapter/${orm}`,
    outputPath: () => `${src}/sedim/auth-adapter.ts`,
    overwriteStrategy: 'ask',
  })

  // Next.js: new files only — no existing file touched
  if (framework === 'nextjs') {
    templates.push({
      templateKey: 'auth/templates/routes/nextjs',
      outputPath: () => `${src}/app/api/auth/[...all]/route.ts`,
      overwriteStrategy: 'ask',
    })
    templates.push({
      templateKey: 'auth/templates/middleware/nextjs',
      outputPath: () => 'middleware.ts',
      overwriteStrategy: 'ask',
    })
  }

  // Express: router + middleware inside sedim/auth
  if (framework === 'express') {
    templates.push({
      templateKey: 'auth/templates/routes/express',
      outputPath: () => `${authDir}/router.ts`,
      overwriteStrategy: 'skip',
    })
    templates.push({
      templateKey: 'auth/templates/middleware/express',
      outputPath: () => `${authDir}/middleware.ts`,
      overwriteStrategy: 'skip',
    })
  }

  // Hono: routes inside sedim/auth
  if (framework === 'hono') {
    templates.push({
      templateKey: 'auth/templates/routes/hono',
      outputPath: () => `${authDir}/routes.ts`,
      overwriteStrategy: 'skip',
    })
  }

  // ── injections — minimal, only where unavoidable ──────────
  const injections: PlanConfig['injections'] = []

  // Express: one import + one mount in entry file — unavoidable
  if (framework === 'express') {
    injections.push({
      type: 'import',
      target: (c: DetectedContext) => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        express: {
          payload: `import { authRouter } from './sedim/auth'`,
          anchor: `import`,
          position: 'after',
        },
      },
    })
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
  }

  // Hono: one import + one mount in entry file — unavoidable
  if (framework === 'hono') {
    injections.push({
      type: 'import',
      target: (c: DetectedContext) => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        hono: {
          payload: `import { authRoutes } from './sedim/auth'`,
          anchor: `import`,
          position: 'after',
        },
      },
    })
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
  }

  // ── dependencies ──────────────────────────────────────────
  const dependencies = ['argon2', '@oslojs/crypto', '@oslojs/encoding']
  if (features.some(f => f.startsWith('oauth-'))) dependencies.push('@oslojs/oauth2')

  // ── env vars — filtered by selected features ──────────────
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
      default: 'http://localhost:3000',
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
      { key: 'SMTP_PORT', description: 'SMTP port — 587 for TLS, 465 for SSL', example: '587', default: '587', required: true },
      { key: 'SMTP_USER', description: 'SMTP username', required: true },
      { key: 'SMTP_PASS', description: 'SMTP password or API key', required: true },
      { key: 'SMTP_FROM', description: 'From address for auth emails', example: 'auth@yourdomain.com', required: true },
    )
  }

  return {
    moduleName: 'auth',
    version: '0.1.0',
    templates,
    injections,
    dependencies,
    devDependencies: [],
    envVars,
    schemaTables,
    peerContracts: [],
    ...(unsupportedReasons.length > 0 ? { _unsupportedReasons: unsupportedReasons } : {}),
  } as PlanConfig
}
