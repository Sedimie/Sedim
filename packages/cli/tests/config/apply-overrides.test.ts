import { describe, expect, it } from 'vitest'
import { applyConfigOverrides } from '../../src/config/apply-overrides'
import type { DetectedContext, SedimConfig } from '../../src/planning/types'

function makeMockContext(): DetectedContext {
  return {
    projectRoot: '/mock/project',
    packageManager: 'pnpm',
    language: { value: 'typescript', confidence: 'high', evidence: [] },
    moduleSystem: { value: 'esm', confidence: 'high', evidence: [] },
    framework: { value: 'express', confidence: 'medium', evidence: [] },
    orm: { value: 'prisma', confidence: 'medium', evidence: [] },
    db: { value: 'mysql', confidence: 'medium', evidence: [] },
    structure: {
      srcDir: 'src',
      routeEntrypoints: ['src/routes.ts'],
      middlewareCandidates: [],
    },
    schema: {
      tables: [],
      probableUserTable: null,
      authSignals: [],
      existingAuthDetected: false,
    },
    codeArchitecture: {
      routerStyle: 'express-router',
      layoutStyle: 'none',
      appEntrypoint: 'src/index.ts',
      apiDir: 'src/api',
      providersFile: null,
      hasBarrelExports: false,
      importStyle: 'named',
      injectionAnchors: {},
    },
    runtime: { nodeVersion: null },
    conflicts: { level: 'none', existingAuthDetected: false, signals: [] },
  }
}

describe('applyConfigOverrides', () => {
  it('returns original context when config or overrides are missing/empty', () => {
    const ctx = makeMockContext()
    expect(applyConfigOverrides(ctx, null)).toBe(ctx)
    expect(applyConfigOverrides(ctx, undefined)).toBe(ctx)
    expect(applyConfigOverrides(ctx, { overrides: {} } as SedimConfig)).toEqual(ctx)
  })

  it('overrides framework, orm, db, language, and moduleSystem correctly', () => {
    const ctx = makeMockContext()
    const config: Partial<SedimConfig> = {
      overrides: {
        framework: 'nextjs',
        orm: 'drizzle',
        db: 'postgres',
        language: 'typescript',
        moduleSystem: 'esm',
      },
    }

    const overridden = applyConfigOverrides(ctx, config)
    expect(overridden.framework.value).toBe('nextjs')
    expect(overridden.framework.evidence).toEqual(['sedim.config.ts override'])

    expect(overridden.orm.value).toBe('drizzle')
    expect(overridden.orm.evidence).toEqual(['sedim.config.ts override'])

    expect(overridden.db.value).toBe('postgres')
    expect(overridden.db.evidence).toEqual(['sedim.config.ts override'])
  })

  it('merges custom structure overrides correctly', () => {
    const ctx = makeMockContext()
    const config: Partial<SedimConfig> = {
      overrides: {
        structure: {
          srcDir: 'custom/src',
          apiDir: 'custom/src/api',
          routeEntrypoints: ['custom/src/server.ts'],
        },
      },
    }

    const overridden = applyConfigOverrides(ctx, config)
    expect(overridden.structure.srcDir).toBe('custom/src')
    expect((overridden.structure as any).apiDir).toBe('custom/src/api')
    expect(overridden.structure.routeEntrypoints).toEqual(['custom/src/server.ts'])
    expect(overridden.structure.middlewareCandidates).toEqual([])
  })

  it('merges custom codeArchitecture overrides correctly', () => {
    const ctx = makeMockContext()
    const config: Partial<SedimConfig> = {
      overrides: {
        codeArchitecture: {
          routerStyle: 'file-based',
          layoutStyle: 'app-router',
          appEntrypoint: 'src/app/layout.tsx',
        },
      },
    }

    const overridden = applyConfigOverrides(ctx, config)
    expect(overridden.codeArchitecture.routerStyle).toBe('file-based')
    expect(overridden.codeArchitecture.layoutStyle).toBe('app-router')
    expect(overridden.codeArchitecture.appEntrypoint).toBe('src/app/layout.tsx')
    expect(overridden.codeArchitecture.importStyle).toBe('named')
  })
})
