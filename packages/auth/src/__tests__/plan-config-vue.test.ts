import { describe, it, expect } from 'vitest'
import { createAuthPlanConfig } from '../plan-config.js'
import type { DetectedContext } from '@sedim/core'

function createFakeContext(overrides: Partial<DetectedContext> = {}): DetectedContext {
  return {
    projectRoot: '/test/express-app',
    packageManager: 'pnpm',
    language: { value: 'typescript', confidence: 'high', evidence: [] },
    moduleSystem: { value: 'esm', confidence: 'high', evidence: [] },
    framework: { value: 'express', confidence: 'high', evidence: [] },
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
        framework: 'express',
        confidence: 'high',
      },
      apiDir: null,
      providersFile: null,
      hasBarrelExports: false,
      importStyle: 'named',
      injectionAnchors: {},
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

describe('createAuthPlanConfig with frontend companions', () => {
  it('reports unsupported reason and skips React UI stamping for Vue frontend companion', () => {
    const ctx = createFakeContext({
      frontend: {
        name: 'frontend',
        absPath: '/test/express-app/frontend',
        relPath: 'frontend',
        framework: 'vue',
        buildTool: 'vite',
      },
    })
    const planConfig = createAuthPlanConfig(ctx, ['email-password'])

    expect((planConfig as any)._unsupportedReasons).toBeDefined()
    expect(
      (planConfig as any)._unsupportedReasons.some((r: string) =>
        r.includes('Vue frontend companions are not yet supported'),
      ),
    ).toBe(true)

    // Verify React UI templates are NOT stamped into Vue frontend dir
    const frontendTemplates = planConfig.templates.filter(t =>
      t.outputPath(ctx).includes('/frontend/'),
    )
    expect(frontendTemplates.length).toBe(0)
  })

  it('stamps React UI templates when frontend companion is React', () => {
    const ctx = createFakeContext({
      frontend: {
        name: 'frontend',
        absPath: '/test/express-app/frontend',
        relPath: 'frontend',
        framework: 'react',
        buildTool: 'vite',
      },
    })
    const planConfig = createAuthPlanConfig(ctx, ['email-password'])

    expect((planConfig as any)._unsupportedReasons).toBeUndefined()

    const frontendTemplates = planConfig.templates.filter(t =>
      t.outputPath(ctx).includes('/frontend/'),
    )
    expect(frontendTemplates.length).toBeGreaterThan(0)
    expect(
      frontendTemplates.some(t => t.outputPath(ctx).endsWith('use-auth.ts')),
    ).toBe(true)
    expect(
      frontendTemplates.some(t => t.outputPath(ctx).endsWith('LoginForm.tsx')),
    ).toBe(true)
  })
})
