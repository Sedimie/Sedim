import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { classifyConflicts } from '../../src/thinker/classify-conflicts'
import type { DetectedContext } from '../../src/planning/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

// minimal DetectedContext stub — only the fields classifyConflicts uses
function makeCtx(overrides: Partial<DetectedContext['conflicts']> = {}): DetectedContext {
  return {
    projectRoot: fix('nextjs-drizzle-ts'),
    packageManager: 'npm',
    language: { value: 'typescript', confidence: 'high', evidence: [] },
    moduleSystem: { value: 'esm', confidence: 'high', evidence: [] },
    framework: { value: 'nextjs', confidence: 'high', evidence: [] },
    orm: { value: 'drizzle', confidence: 'high', evidence: [] },
    db: { value: 'postgres', confidence: 'high', evidence: [] },
    structure: { srcDir: 'src', routeEntrypoints: [], middlewareCandidates: [] },
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
    conflicts: {
      level: 'none',
      existingAuthDetected: false,
      signals: [],
      ...overrides,
    },
  }
}

describe('classifyConflicts', () => {
  it('returns none when no files exist and no auth detected', async () => {
    const ctx = makeCtx()
    const result = await classifyConflicts(fix('nextjs-drizzle-ts'), ctx, ['src/lib/auth.ts'], ['users'])
    // src/lib/auth.ts doesn't exist in the fixture — no conflict
    expect(result.level).toBe('none')
    expect(result.actions).toHaveLength(0)
  })

  it('returns partial when a file to create already exists', async () => {
    const ctx = makeCtx()
    // src/app/layout.tsx exists in the fixture
    const result = await classifyConflicts(
      fix('nextjs-drizzle-ts'),
      ctx,
      ['src/app/layout.tsx'],
      [],
    )
    expect(result.level).toBe('partial')
    expect(result.actions.some(a => a.file === 'src/app/layout.tsx')).toBe(true)
    expect(result.actions[0].resolution).toBe('pending-user-choice')
  })

  it('returns partial when existing auth is detected', async () => {
    const ctx = makeCtx({
      existingAuthDetected: true,
      signals: ['next-auth found in dependencies'],
    })
    const result = await classifyConflicts(fix('nextjs-drizzle-ts'), ctx, [], [])
    expect(result.level).toBe('partial')
    expect(result.actions.some(a => a.description.includes('next-auth'))).toBe(true)
  })

  it('returns full when existing auth + files to modify both conflict', async () => {
    const ctx = makeCtx({
      existingAuthDetected: true,
      signals: ['next-auth found', 'auth file found'],
    })
    // two signals + existing auth = full conflict
    const result = await classifyConflicts(
      fix('nextjs-drizzle-ts'),
      ctx,
      ['src/app/layout.tsx'], // this file exists
      [],
    )
    expect(result.level).toBe('full')
  })
})
