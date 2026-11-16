import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DetectedContext } from '../../src/planning/types.js'
import {
  clearTemplateCache,
  resolveTemplate,
  tryFetch,
} from '../../src/thinker/resolve-template.js'

describe('resolveTemplate in-run caching and concurrent fetching', () => {
  const originalFetch = globalThis.fetch

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
    clearTemplateCache()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearTemplateCache()
    vi.restoreAllMocks()
  })

  it('caches tryFetch results so the same URL is only requested once', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('export const a = 1;'),
    } as unknown as Response)
    globalThis.fetch = fetchMock

    const res1 = await tryFetch('https://example.com/file.ts')
    const res2 = await tryFetch('https://example.com/file.ts')

    expect(res1).toBe('export const a = 1;')
    expect(res2).toBe('export const a = 1;')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caches raw template content across multiple resolveTemplate invocations', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/src/core/hash-password.ts')) {
        return {
          ok: true,
          status: 200,
          text: async () => 'export async function hashPassword() {}',
        } as Response
      }
      return { ok: false, status: 404, text: async () => '' } as Response
    })
    globalThis.fetch = fetchMock

    const first = await resolveTemplate('auth/core/hash-password', mockCtx)
    const second = await resolveTemplate('auth/core/hash-password', mockCtx)

    expect(first).toContain('hashPassword')
    expect(second).toContain('hashPassword')

    // After the first resolution, the second should be served entirely from rawTemplateCache
    const totalCallsAfterFirst = fetchMock.mock.calls.length
    await resolveTemplate('auth/core/hash-password', mockCtx)
    expect(fetchMock.mock.calls.length).toBe(totalCallsAfterFirst)
  })

  it('clears cache when clearTemplateCache is called', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/src/core/hash-password.ts')) {
        return {
          ok: true,
          status: 200,
          text: async () => 'export async function hashPassword() {}',
        } as Response
      }
      return { ok: false, status: 404, text: async () => '' } as Response
    })
    globalThis.fetch = fetchMock

    await resolveTemplate('auth/core/hash-password', mockCtx)
    const callsBeforeClear = fetchMock.mock.calls.length

    clearTemplateCache()

    await resolveTemplate('auth/core/hash-password', mockCtx)
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeClear)
  })
})
