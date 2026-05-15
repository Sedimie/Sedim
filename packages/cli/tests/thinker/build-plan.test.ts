import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildPlan } from '../../src/thinker/build-plan'
import { PlanError } from '../../src/shared/errors'
import type { DetectedContext, PlanConfig } from '../../src/planning/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

// minimal DetectedContext for a clean Next.js project
function makeCtx(overrides: Partial<DetectedContext> = {}): DetectedContext {
  return {
    projectRoot: fix('nextjs-drizzle-ts'),
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

// minimal PlanConfig for auth module
function makePlanConfig(overrides: Partial<PlanConfig> = {}): PlanConfig {
  return {
    moduleName: 'auth',
    version: '0.1.0',
    templates: [
      {
        templateKey: 'auth/config',
        outputPath: ctx =>
          `${ctx.structure.srcDir ?? 'src'}/lib/auth.ts`,
        overwriteStrategy: 'ask',
      },
      {
        templateKey: 'auth/route',
        outputPath: ctx =>
          ctx.codeArchitecture.layoutStyle === 'app-router'
            ? 'src/app/api/auth/[...all]/route.ts'
            : 'src/pages/api/auth.ts',
        overwriteStrategy: 'ask',
      },
    ],
    injections: [
      {
        type: 'provider-wrap',
        target: ctx =>
          ctx.codeArchitecture.layoutStyle === 'app-router'
            ? 'src/app/layout.tsx'
            : null,
        variants: {
          nextjs: {
            payload: '<AuthProvider>{children}</AuthProvider>',
            anchor: '{children}',
            position: 'before',
          },
        },
      },
    ],
    dependencies: ['better-auth'],
    devDependencies: [],
    envVars: [
      { key: 'AUTH_SECRET', description: 'signing secret', required: true },
      { key: 'DATABASE_URL', description: 'postgres connection', required: true },
    ],
    schemaTables: ['users', 'sessions'],
    peerContracts: [],
    ...overrides,
  }
}

describe('buildPlan', () => {
  it('produces a valid InstallPlan shape', async () => {
    const ctx = makeCtx()
    const config = makePlanConfig()
    const plan = await buildPlan(ctx, config, ['email-password'])

    expect(plan.moduleName).toBe('auth')
    expect(plan.selectedFeatures).toEqual(['email-password'])
    expect(plan).toHaveProperty('filesToCreate')
    expect(plan).toHaveProperty('filesToModify')
    expect(plan).toHaveProperty('injectionActions')
    expect(plan).toHaveProperty('conflictActions')
    expect(plan).toHaveProperty('rollbackHints')
  })

  it('resolves template outputPath using ctx', async () => {
    const ctx = makeCtx()
    const plan = await buildPlan(ctx, makePlanConfig(), [])

    const paths = plan.filesToCreate.map(f => f.path)
    expect(paths).toContain('src/lib/auth.ts')
    // app-router layout → app/api path
    expect(paths).toContain('src/app/api/auth/[...all]/route.ts')
  })

  it('resolves injection variant for nextjs framework', async () => {
    const ctx = makeCtx()
    const plan = await buildPlan(ctx, makePlanConfig(), [])

    const providerWrap = plan.injectionActions.find(a => a.type === 'provider-wrap')
    expect(providerWrap).toBeDefined()
    expect(providerWrap!.file).toBe('src/app/layout.tsx')
    expect(providerWrap!.payload).toContain('AuthProvider')
  })

  it('skips injection when target returns null', async () => {
    // pages-router ctx — provider-wrap target returns null for app-router check
    const ctx = makeCtx({
      codeArchitecture: {
        routerStyle: 'file-based',
        layoutStyle: 'pages-router', // not app-router
        appEntrypoint: null,
        apiDir: 'src/pages/api',
        providersFile: null,
        hasBarrelExports: false,
        importStyle: 'named',
        injectionAnchors: {},
      },
    })

    const plan = await buildPlan(ctx, makePlanConfig(), [])
    const providerWrap = plan.injectionActions.find(a => a.type === 'provider-wrap')
    expect(providerWrap).toBeUndefined()
  })

  it('uses AST anchor over variant anchor when available', async () => {
    const ctx = makeCtx({
      codeArchitecture: {
        routerStyle: 'file-based',
        layoutStyle: 'app-router',
        appEntrypoint: null,
        apiDir: 'src/app/api',
        providersFile: null,
        hasBarrelExports: false,
        importStyle: 'named',
        injectionAnchors: {
          'provider-wrap': {
            file: 'src/app/layout.tsx',
            anchorText: '<body className="font-sans">', // AST found a specific anchor
            position: 'after',
            description: 'after <body> tag',
          },
        },
      },
    })

    const plan = await buildPlan(ctx, makePlanConfig(), [])
    const providerWrap = plan.injectionActions.find(a => a.type === 'provider-wrap')

    // should use AST anchor text, not the variant's anchor
    expect(providerWrap!.anchor).toBe('<body className="font-sans">')
    expect(providerWrap!.position).toBe('after')
  })

  it('maps env vars correctly', async () => {
    const plan = await buildPlan(makeCtx(), makePlanConfig(), [])

    expect(plan.envVarsToAdd).toHaveLength(2)
    expect(plan.envVarsToAdd.find(e => e.key === 'AUTH_SECRET')).toBeDefined()
    expect(plan.envVarsToAdd.find(e => e.key === 'DATABASE_URL')).toBeDefined()
  })

  it('generates migration name when schemaTables present', async () => {
    const plan = await buildPlan(makeCtx(), makePlanConfig(), [])
    expect(plan.migrationsToCreate).toHaveLength(1)
    expect(plan.migrationsToCreate[0]).toContain('add_auth_tables')
  })

  it('generates no migrations when schemaTables is empty', async () => {
    const config = makePlanConfig({ schemaTables: [] })
    const plan = await buildPlan(makeCtx(), config, [])
    expect(plan.migrationsToCreate).toHaveLength(0)
  })

  it('includes rollback hints for created and modified files', async () => {
    const plan = await buildPlan(makeCtx(), makePlanConfig(), [])

    expect(plan.rollbackHints.some(h => h.includes('src/lib/auth.ts'))).toBe(true)
  })

  it('throws PlanError for invalid version format', async () => {
    const config = makePlanConfig({ version: 'not-semver' })
    await expect(buildPlan(makeCtx(), config, [])).rejects.toThrow(PlanError)
    await expect(buildPlan(makeCtx(), config, [])).rejects.toThrow('Invalid manifest version')
  })

  it('throws PlanError for incompatible major version', async () => {
    const config = makePlanConfig({ version: '2.0.0' }) // major mismatch
    await expect(buildPlan(makeCtx(), config, [])).rejects.toThrow(PlanError)
    await expect(buildPlan(makeCtx(), config, [])).rejects.toThrow('not compatible')
  })

  it('accepts valid version', async () => {
    const config = makePlanConfig({ version: '0.1.0' })
    await expect(buildPlan(makeCtx(), config, [])).resolves.toBeDefined()
  })
})
