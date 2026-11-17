import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createHealthPlanConfig } from '../../../../examples/minimal-module/src/plan-config.js'
import type { DetectedContext } from '../../src/planning/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

function makeCtx(overrides: Partial<DetectedContext> = {}): DetectedContext {
  return {
    projectRoot: fix('express-prisma-ts'),
    packageManager: 'npm',
    language: { value: 'typescript', confidence: 'high', evidence: [] },
    moduleSystem: { value: 'esm', confidence: 'high', evidence: [] },
    framework: { value: 'express', confidence: 'high', evidence: [] },
    orm: { value: 'prisma', confidence: 'high', evidence: [] },
    db: { value: 'postgres', confidence: 'high', evidence: [] },
    structure: { srcDir: 'src', routeEntrypoints: ['src/app.ts'], middlewareCandidates: [] },
    schema: { tables: [], probableUserTable: null, authSignals: [], existingAuthDetected: false },
    codeArchitecture: {
      routerStyle: 'express-router',
      layoutStyle: 'none',
      appEntrypoint: { file: 'src/app.ts', confidence: 'high' },
      apiDir: null,
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

describe('Minimal Example Module Contract', () => {
  it('generates a valid PlanConfig for an Express host project', () => {
    const ctx = makeCtx()
    const planConfig = createHealthPlanConfig(ctx, ['uptime'])

    expect(planConfig.moduleName).toBe('health')
    expect(planConfig.version).toBe('1.0.0')
    expect(planConfig.templates).toHaveLength(1)
    expect(planConfig.templates[0].templateKey).toBe('health/health-check')
    expect(planConfig.templates[0].outputPath(ctx)).toBe('src/sedim/health/health-check.ts')
    expect(planConfig.templates[0].overwriteStrategy).toBe('skip')

    expect(planConfig.injections).toHaveLength(2)
    expect(planConfig.injections[0].type).toBe('import')
    expect(planConfig.injections[1].type).toBe('route')
    expect(planConfig.injections[1].variants.express?.payload).toContain('/health')
  })

  it('skips entrypoint injections if not using Express', () => {
    const nextCtx = makeCtx({
      framework: { value: 'nextjs', confidence: 'high', evidence: [] },
    })
    const planConfig = createHealthPlanConfig(nextCtx, [])

    expect(planConfig.templates).toHaveLength(1)
    expect(planConfig.injections).toHaveLength(0)
  })
})
