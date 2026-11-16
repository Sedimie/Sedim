import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DetectedContext } from '../../src/planning/types.js'
import {
  findMonorepoPackagesRoot,
  resolveLocalTemplate,
  resolveTemplate,
} from '../../src/thinker/resolve-template.js'

describe('local-first template resolution', () => {
  const originalEnv = process.env['SEDIM_LOCAL_PATH']
  const originalFetch = globalThis.fetch
  let tempDir: string

  const mockCtx: DetectedContext = {
    projectRoot: '/test',
    packageJson: {},
    framework: { value: 'nextjs', confidence: 1 },
    orm: { value: 'drizzle', confidence: 1 },
    db: { value: 'postgres', confidence: 1 },
    language: 'ts',
    packageManager: 'pnpm',
    structure: { srcDir: 'src', routesDir: 'src/app' },
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sedim-test-local-'))
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['SEDIM_LOCAL_PATH'] = originalEnv
    } else {
      delete process.env['SEDIM_LOCAL_PATH']
    }
    globalThis.fetch = originalFetch
    fs.rmSync(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('detects SEDIM_LOCAL_PATH override when set', () => {
    process.env['SEDIM_LOCAL_PATH'] = tempDir
    expect(findMonorepoPackagesRoot('/some/random/dir')).toBe(tempDir)
  })

  it('resolves local template from disk without calling fetch', async () => {
    const authSrc = path.join(tempDir, 'auth', 'src', 'core')
    fs.mkdirSync(authSrc, { recursive: true })
    fs.writeFileSync(
      path.join(authSrc, 'custom-op.ts'),
      'export function customOp() { return "local"; }',
      'utf-8',
    )

    process.env['SEDIM_LOCAL_PATH'] = tempDir

    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const localContent = await resolveLocalTemplate('auth', 'core/custom-op')
    expect(localContent).toBe('export function customOp() { return "local"; }')

    const resolved = await resolveTemplate('auth/core/custom-op', mockCtx)
    expect(resolved).toContain('customOp')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to remote fetch when template is not found locally', async () => {
    process.env['SEDIM_LOCAL_PATH'] = tempDir

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('export const remote = true;'),
    } as unknown as Response)
    globalThis.fetch = fetchMock

    const resolved = await resolveTemplate('auth/core/remote-only', mockCtx)
    expect(resolved).toBe('export const remote = true;')
    expect(fetchMock).toHaveBeenCalled()
  })
})
