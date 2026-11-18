import { describe, it, expect } from 'vitest'
import { createAuthPlanConfig } from '../plan-config.js'
import type { DetectedContext } from '@sedim/core'

function createFakeContext(overrides: Partial<DetectedContext> = {}): DetectedContext {
  return {
    projectRoot: '/test/fastify-app',
    packageManager: 'pnpm',
    language: { value: 'typescript', confidence: 'high', evidence: [] },
    moduleSystem: { value: 'esm', confidence: 'high', evidence: [] },
    framework: { value: 'fastify', confidence: 'high', evidence: [] },
    orm: { value: 'prisma', confidence: 'high', evidence: [] },
    db: { value: 'postgres', confidence: 'high', evidence: [] },
    structure: {
      srcDir: 'src',
      routeEntrypoints: ['src/app.ts'],
      middlewareCandidates: [],
    },
    schema: {
      tables: [],
      probableUserTable: null,
      authSignals: [],
      existingAuthDetected: false,
    },
    codeArchitecture: {
      routerStyle: 'express-style',
      layoutStyle: 'flat',
      appEntrypoint: {
        file: 'src/app.ts',
        variable: 'app',
        framework: 'fastify',
        confidence: 'high',
      },
      apiDir: null,
      providersFile: null,
      hasBarrelExports: false,
      importStyle: 'named',
      injectionAnchors: {
        import: {
          file: 'src/app.ts',
          anchorText: "import fastify from 'fastify'",
          position: 'after',
          confidence: 'high',
          strategy: 'after-imports',
        },
        route: {
          file: 'src/app.ts',
          anchorText: 'app.listen',
          position: 'before',
          confidence: 'high',
          strategy: 'before-listen',
        },
      },
    },
    runtime: { nodeVersion: null },
    conflicts: {
      level: 'none',
      existingAuthDetected: false,
      signals: [],
    },
    ...overrides,
  }
}

describe('createAuthPlanConfig with Fastify', () => {
  it('does not report unsupportedReasons for Fastify', () => {
    const ctx = createFakeContext()
    const planConfig = createAuthPlanConfig(ctx, ['email-password'])

    expect((planConfig as any)._unsupportedReasons).toBeUndefined()
  })

  it('includes Fastify framework adapter, route, and middleware templates', () => {
    const ctx = createFakeContext()
    const planConfig = createAuthPlanConfig(ctx, ['email-password'])

    const templateKeys = planConfig.templates.map(t => t.templateKey)
    expect(templateKeys).toContain('auth/adapters/framework/fastify')
    expect(templateKeys).toContain('auth/templates/routes/fastify')
    expect(templateKeys).toContain('auth/templates/middleware/fastify')

    const routesTemplate = planConfig.templates.find(t => t.templateKey === 'auth/templates/routes/fastify')
    expect(routesTemplate?.outputPath(ctx)).toBe('src/sedim/auth/routes.ts')

    const middlewareTemplate = planConfig.templates.find(t => t.templateKey === 'auth/templates/middleware/fastify')
    expect(middlewareTemplate?.outputPath(ctx)).toBe('src/sedim/auth/middleware.ts')

    const adapterTemplate = planConfig.templates.find(t => t.templateKey === 'auth/adapters/framework/fastify')
    expect(adapterTemplate?.outputPath(ctx)).toBe('src/sedim/auth/adapters/framework/fastify.ts')
  })

  it('configures Fastify import and route registration injections', () => {
    const ctx = createFakeContext()
    const planConfig = createAuthPlanConfig(ctx, ['email-password'])

    const importInjection = planConfig.injections.find(i => i.type === 'import')
    expect(importInjection).toBeDefined()
    expect(importInjection?.variants.fastify?.payload).toBe("import { authPlugin } from './sedim/auth'")

    const routeInjection = planConfig.injections.find(i => i.type === 'route')
    expect(routeInjection).toBeDefined()
    expect(routeInjection?.variants.fastify?.payload).toBe("app.register(authPlugin, { prefix: '/auth' })")
    expect(routeInjection?.variants.fastify?.anchor).toBe('app.listen')
    expect(routeInjection?.variants.fastify?.position).toBe('before')
  })
})
