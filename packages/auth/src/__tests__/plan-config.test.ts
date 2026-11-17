import { describe, it, expect } from 'vitest'
import { createAuthPlanConfig } from '../plan-config.js'
import type { DetectedContext } from '@sedim/core'

function createMockContext(overrides: Partial<DetectedContext> = {}): DetectedContext {
  return {
    projectRoot: '/mock/project',
    packageManager: 'npm',
    language: { value: 'typescript', confidence: 'high', evidence: [] },
    moduleSystem: { value: 'esm', confidence: 'high', evidence: [] },
    framework: { value: 'nextjs', confidence: 'high', evidence: [] },
    orm: { value: 'drizzle', confidence: 'high', evidence: [] },
    db: { value: 'postgres', confidence: 'high', evidence: [] },
    structure: { srcDir: 'src', routeEntrypoints: ['src/app'], middlewareCandidates: [] },
    schema: { tables: [], probableUserTable: null, authSignals: [], existingAuthDetected: false },
    codeArchitecture: {
      routerStyle: 'file-based',
      layoutStyle: 'app-router',
      appEntrypoint: null,
      apiDir: 'src/app/api',
      providersFile: null,
      hasBarrelExports: false,
      importStyle: 'named',
      injectionAnchors: {},
    },
    runtime: { nodeVersion: null },
    conflicts: { level: 'none', existingAuthDetected: false, signals: [] },
    ...overrides,
  }
}

describe('createAuthPlanConfig template and feature mapping', () => {
  it('rejects unsupported javascript-only projects', () => {
    const ctx = createMockContext({
      language: { value: 'javascript', confidence: 'high', evidence: [] },
    })
    const plan = createAuthPlanConfig(ctx, ['email-password']) as any
    expect(plan._unsupportedReasons).toContain(
      'JavaScript-only projects are not yet supported. Auth requires TypeScript.',
    )
  })

  it('rejects unsupported orm = none', () => {
    const ctx = createMockContext({
      orm: { value: 'none', confidence: 'high', evidence: [] },
    })
    const plan = createAuthPlanConfig(ctx, ['email-password']) as any
    expect(plan._unsupportedReasons).toContain(
      'No ORM detected. Auth requires Drizzle or Prisma.',
    )
  })

  it('maps Next.js App Router route templates correctly', () => {
    const ctx = createMockContext()
    const plan = createAuthPlanConfig(ctx, ['email-password'])
    expect((plan as any)._unsupportedReasons).toBeUndefined()

    const templateKeys = plan.templates.map(t => t.templateKey)
    expect(templateKeys).toContain('auth/core/hash-password')
    expect(templateKeys).toContain('auth/core/session')
    expect(templateKeys).toContain('auth/core/email-transport')
    expect(templateKeys).toContain('auth/adapters/framework/nextjs')

    const nextAdapter = plan.templates.find(t => t.templateKey === 'auth/adapters/framework/nextjs')
    expect(nextAdapter).toBeDefined()
    expect(nextAdapter?.outputPath(ctx)).toBe('src/sedim/auth/adapters/framework/nextjs.ts')
  })

  it('maps Express routing and middleware templates correctly', () => {
    const ctx = createMockContext({
      framework: { value: 'express', confidence: 'high', evidence: [] },
      orm: { value: 'prisma', confidence: 'high', evidence: [] },
      codeArchitecture: {
        routerStyle: 'express-router',
        layoutStyle: 'flat',
        appEntrypoint: 'src/app.ts',
        apiDir: null,
        providersFile: null,
        hasBarrelExports: false,
        importStyle: 'named',
        injectionAnchors: {},
      },
    })
    const plan = createAuthPlanConfig(ctx, ['email-password'])
    const templateKeys = plan.templates.map(t => t.templateKey)
    expect(templateKeys).toContain('auth/adapters/framework/express')
    expect(templateKeys).toContain('auth/adapters/prisma')
    expect(templateKeys).toContain('auth/schema/prisma-base')
  })

  it('maps Hono routing and middleware templates correctly', () => {
    const ctx = createMockContext({
      framework: { value: 'hono', confidence: 'high', evidence: [] },
      orm: { value: 'drizzle', confidence: 'high', evidence: [] },
      codeArchitecture: {
        routerStyle: 'hono-routes',
        layoutStyle: 'flat',
        appEntrypoint: 'src/index.ts',
        apiDir: null,
        providersFile: null,
        hasBarrelExports: false,
        importStyle: 'named',
        injectionAnchors: {},
      },
    })
    const plan = createAuthPlanConfig(ctx, ['email-password'])
    const templateKeys = plan.templates.map(t => t.templateKey)
    expect(templateKeys).toContain('auth/adapters/framework/hono')
    expect(templateKeys).toContain('auth/adapters/drizzle')
    expect(templateKeys).toContain('auth/schema/drizzle')
  })

  it('maps themed UI token templates when themed UI tier is selected', () => {
    const ctx = createMockContext()
    const planModern = createAuthPlanConfig(ctx, ['email-password', 'themed', 'modern'])
    const modernKeys = planModern.templates.map(t => t.templateKey)
    expect(modernKeys).toContain('auth/ui/themed/modern-tokens.css')
    expect(modernKeys).toContain('auth/ui/themed/LoginForm')
    expect(modernKeys).toContain('auth/ui/themed/SignupForm')

    const planMinimal = createAuthPlanConfig(ctx, ['email-password', 'themed', 'minimal'])
    const minimalKeys = planMinimal.templates.map(t => t.templateKey)
    expect(minimalKeys).toContain('auth/ui/themed/minimal-tokens.css')

    const planColorful = createAuthPlanConfig(ctx, ['email-password', 'themed', 'colorful'])
    const colorfulKeys = planColorful.templates.map(t => t.templateKey)
    expect(colorfulKeys).toContain('auth/ui/themed/colorful-tokens.css')
  })

  it('maps OAuth and OIDC dependencies and env vars when oauth is selected', () => {
    const ctx = createMockContext()
    const plan = createAuthPlanConfig(ctx, ['email-password', 'oauth-google', 'oauth-github'])
    expect(plan.dependencies).toContain('@oslojs/oauth2')
    const envKeys = plan.envVars.map(e => e.key)
    expect(envKeys).toContain('GOOGLE_CLIENT_ID')
    expect(envKeys).toContain('GOOGLE_CLIENT_SECRET')
    expect(envKeys).toContain('GITHUB_CLIENT_ID')
    expect(envKeys).toContain('GITHUB_CLIENT_SECRET')
  })

  it('generates required email dependencies when email features are selected', () => {
    const ctx = createMockContext()
    const plan = createAuthPlanConfig(ctx, ['email-password'])
    expect(plan.dependencies).toContain('nodemailer')
    expect(plan.devDependencies).toContain('@types/nodemailer')
  })
})
