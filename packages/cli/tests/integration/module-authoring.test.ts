import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, readFile, writeFile as fsWriteFile, mkdir } from 'node:fs/promises'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { loadModuleManifest } from '../../src/thinker/load-module-manifest'
import { loadPlanConfig } from '../../src/thinker/load-plan-config'
import { buildPlan } from '../../src/thinker/build-plan'
import { applyPlan } from '../../src/writer/apply-plan'
import type { DetectedContext } from '../../src/planning/types'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'sedim-module-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

function createExpressContext(projectRoot: string): DetectedContext {
  return {
    projectRoot,
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
      injectionAnchors: {
        import: {
          file: 'src/app.ts',
          anchorText: "import express from 'express'",
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
  }
}

describe('module authoring end-to-end contract', () => {
  it('loads health manifest from local registry', async () => {
    const manifest = await loadModuleManifest('health')
    expect(manifest.name).toBe('health')
    expect(manifest.version).toBe('0.1.0')
    expect(manifest.features.checks).toContain('basic')
    expect(manifest.features.checks).toContain('detailed')
  })

  it('loads health plan-config dynamically via createHealthPlanConfig convention', async () => {
    const manifest = await loadModuleManifest('health')
    const ctx = createExpressContext(tmpDir)
    const planConfig = await loadPlanConfig('health', manifest, ctx, ['basic'])

    expect(planConfig.moduleName).toBe('health')
    expect(planConfig.version).toBe('0.1.0')
    expect(planConfig.templates.length).toBeGreaterThan(0)
    expect(planConfig.injections.length).toBeGreaterThan(0)

    const routerTemplate = planConfig.templates.find(t => t.outputPath(ctx).includes('router.ts'))
    expect(routerTemplate).toBeDefined()
  })

  it('computes install plan and stamps files end-to-end', async () => {
    // Setup minimal app.ts in tmpDir
    await mkdir(path.join(tmpDir, 'src'), { recursive: true })
    const appTsContent = `import express from 'express'\n\nconst app = express()\n\napp.listen(3000, () => {})\n`
    await fsWriteFile(path.join(tmpDir, 'src/app.ts'), appTsContent, 'utf8')

    const manifest = await loadModuleManifest('health')
    const ctx = createExpressContext(tmpDir)
    const planConfig = await loadPlanConfig('health', manifest, ctx, ['basic'])
    const plan = await buildPlan(ctx, planConfig, ['basic'])

    expect(plan.moduleName).toBe('health')
    expect(plan.filesToCreate.length).toBe(1)
    expect(plan.injectionActions.length).toBe(2)

    await applyPlan(tmpDir, plan)

    // Verify stamped router file exists
    const stampedRouter = await readFile(path.join(tmpDir, 'src/sedim/health/router.ts'), 'utf8')
    expect(stampedRouter).toContain('healthRouter')
    expect(stampedRouter).toContain("status: 'ok'")

    // Verify injected app.ts has import and route mount
    const updatedAppTs = await readFile(path.join(tmpDir, 'src/app.ts'), 'utf8')
    expect(updatedAppTs).toContain("import { healthRouter } from './sedim/health/router'")
    expect(updatedAppTs).toContain("app.use('/health', healthRouter)")
  })
})
