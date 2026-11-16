import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DetectedContext } from '../../src/planning/types.js'
import { RegistryError } from '../../src/shared/errors.js'
import { resolveTemplate, tryFetch } from '../../src/thinker/resolve-template.js'

describe('tryFetch and resolveTemplate error handling', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns null on 404 so template resolution can fall through to next candidate', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn(),
    } as unknown as Response)

    const result = await tryFetch('https://example.com/not-found.ts')
    expect(result).toBeNull()
  })

  it('returns response text on 200 OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('export const hello = "world"'),
    } as unknown as Response)

    const result = await tryFetch('https://example.com/found.ts')
    expect(result).toBe('export const hello = "world"')
  })

  it('throws RegistryError on 429 rate limit with actionable nextAction', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn(),
    } as unknown as Response)

    await expect(tryFetch('https://example.com/template.ts')).rejects.toThrow(RegistryError)
    await expect(tryFetch('https://example.com/template.ts')).rejects.toThrow(/rate limit/i)
  })

  it('throws RegistryError on 500 server error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn(),
    } as unknown as Response)

    await expect(tryFetch('https://example.com/template.ts')).rejects.toThrow(RegistryError)
    await expect(tryFetch('https://example.com/template.ts')).rejects.toThrow(/server error/i)
  })

  it('throws RegistryError when fetch throws a network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed: ENOTFOUND'))

    await expect(tryFetch('https://example.com/template.ts')).rejects.toThrow(RegistryError)
    await expect(tryFetch('https://example.com/template.ts')).rejects.toThrow(/ENOTFOUND/)
  })

  it('surfaces RegistryError during resolveTemplate instead of swallowing as template-not-found', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn(),
    } as unknown as Response)

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

    await expect(resolveTemplate('auth/core/hash-password', mockCtx, ['email-password'])).rejects.toThrow(
      RegistryError,
    )
  })
})
