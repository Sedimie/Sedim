import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DetectedContext } from '../../src/planning/types.js'
import {
  clearTemplateCache,
  resolveTemplate,
  stripRelativeJsExtensions,
  tryFetch,
} from '../../src/thinker/resolve-template'

describe('stripRelativeJsExtensions', () => {
  it('strips .js from static imports and re-exports', () => {
    const input = `
import { foo } from './foo.js'
import * as bar from '../bar.js'
import defaultExport from "../../deep/path.js"
import type { TypeA } from './types.js'
export { baz } from './baz.js'
export * from '../all.js'
export type { TypeB } from './types.js'
`
    const expected = `
import { foo } from './foo'
import * as bar from '../bar'
import defaultExport from "../../deep/path"
import type { TypeA } from './types'
export { baz } from './baz'
export * from '../all'
export type { TypeB } from './types'
`
    expect(stripRelativeJsExtensions(input)).toBe(expected)
  })

  it('strips .js from dynamic relative imports', () => {
    const input = `
const oidc = await import('../../core/oidc.js')
const router = await import('./router.js')
const spaced = await import(  './spaced.js'  )
const multiline = await import(
  './multiline.js'
)
const doubleQuoted = await import("../core/oidc.js")
const backticked = await import(\`../../core/oidc.js\`)
const withOptions = await import('./data.js', { with: { type: 'json' } })
const chained = await import('./helper.js').then(m => m.default)
`
    const expected = `
const oidc = await import('../../core/oidc')
const router = await import('./router')
const spaced = await import(  './spaced'  )
const multiline = await import(
  './multiline'
)
const doubleQuoted = await import("../core/oidc")
const backticked = await import(\`../../core/oidc\`)
const withOptions = await import('./data', { with: { type: 'json' } })
const chained = await import('./helper').then(m => m.default)
`
    expect(stripRelativeJsExtensions(input)).toBe(expected)
  })

  it('strips .js from side-effect imports', () => {
    const input = `
import './polyfill.js'
import "../styles/setup.js"
`
    const expected = `
import './polyfill'
import "../styles/setup"
`
    expect(stripRelativeJsExtensions(input)).toBe(expected)
  })

  it('strips .js from TypeScript type queries with import()', () => {
    const input = `
type User = import('../../adapters/types.js').User
type Router = typeof import('./router.js')
`
    const expected = `
type User = import('../../adapters/types').User
type Router = typeof import('./router')
`
    expect(stripRelativeJsExtensions(input)).toBe(expected)
  })

  it('does not touch third-party package specifiers', () => {
    const input = `
import argon2 from 'argon2'
import { sha256 } from '@oslojs/crypto/sha2'
import 'package-name/styles.js'
const pkg = await import('drizzle-orm/neon-http')
const pkgJs = await import('drizzle-orm/neon-http.js')
const scoped = await import('@auth/core/oidc.js')
const node = await import('node:fs')
`
    expect(stripRelativeJsExtensions(input)).toBe(input)
  })

  it('does not touch non-js relative imports or absolute paths', () => {
    const input = `
import './styles.css'
import './schema.prisma'
const json = await import('./config.json')
import '/absolute/path.js'
const abs = await import('/absolute/path.js')
`
    expect(stripRelativeJsExtensions(input)).toBe(input)
  })

  it('handles mixed templates with static, dynamic, and external imports correctly', () => {
    const input = `
import { defineModule } from '@sedim/core'
import { config } from './config.js'
import './setup.js'

export async function run() {
  const { validateIdToken } = await import('../../core/oidc.js')
  const argon2 = await import('argon2')
  return { config, validateIdToken, argon2 }
}

export * from './barrel.js'
`
    const expected = `
import { defineModule } from '@sedim/core'
import { config } from './config'
import './setup'

export async function run() {
  const { validateIdToken } = await import('../../core/oidc')
  const argon2 = await import('argon2')
  return { config, validateIdToken, argon2 }
}

export * from './barrel'
`
    expect(stripRelativeJsExtensions(input)).toBe(expected)
  })
})

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

  it('caches tryFetch 200 responses so the same URL is only requested once', async () => {
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

  it('caches tryFetch 404 responses so the same missing URL is not re-queried', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue(''),
    } as unknown as Response)
    globalThis.fetch = fetchMock

    const res1 = await tryFetch('https://example.com/missing.ts')
    const res2 = await tryFetch('https://example.com/missing.ts')

    expect(res1).toBeNull()
    expect(res2).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deduplicates simultaneous in-flight requests for the exact same URL', async () => {
    let resolvePromise: (value: Response) => void
    const pending = new Promise<Response>(resolve => {
      resolvePromise = resolve
    })
    const fetchMock = vi.fn().mockReturnValue(pending)
    globalThis.fetch = fetchMock

    const p1 = tryFetch('https://example.com/shared.ts')
    const p2 = tryFetch('https://example.com/shared.ts')

    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolvePromise!({
      ok: true,
      status: 200,
      text: async () => 'shared content',
    } as unknown as Response)

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('shared content')
    expect(r2).toBe('shared content')
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

    const totalCallsAfterFirst = fetchMock.mock.calls.length
    await resolveTemplate('auth/core/hash-password', mockCtx)
    expect(fetchMock.mock.calls.length).toBe(totalCallsAfterFirst)
  })

  it('respects file extension priority order (.ts before .tsx)', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/src/ui/form.ts')) {
        return {
          ok: true,
          status: 200,
          text: async () => '// TS version',
        } as Response
      }
      if (url.endsWith('/auth/src/ui/form.tsx')) {
        return {
          ok: true,
          status: 200,
          text: async () => '// TSX version',
        } as Response
      }
      return { ok: false, status: 404, text: async () => '' } as Response
    })
    globalThis.fetch = fetchMock

    const result = await resolveTemplate('auth/ui/form', mockCtx)
    expect(result).toBe('// TS version')
  })

  it('correctly resolves paths that already have extensions without probing unnecessary variants', async () => {
    const requestedUrls: string[] = []
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      requestedUrls.push(url)
      if (url.endsWith('/auth/src/ui/themed/tokens.css')) {
        return {
          ok: true,
          status: 200,
          text: async () => ':root { --color: red; }',
        } as Response
      }
      return { ok: false, status: 404, text: async () => '' } as Response
    })
    globalThis.fetch = fetchMock

    const result = await resolveTemplate('auth/ui/themed/tokens.css', mockCtx)
    expect(result).toBe(':root { --color: red; }')
    expect(requestedUrls.some(u => u.endsWith('.css.ts'))).toBe(false)
  })

  it('does not probe templates/ directory when primary src/ candidate succeeds', async () => {
    const requestedUrls: string[] = []
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      requestedUrls.push(url)
      if (url.endsWith('/auth/src/core/session.ts')) {
        return {
          ok: true,
          status: 200,
          text: async () => 'export const session = true;',
        } as Response
      }
      return { ok: false, status: 404, text: async () => '' } as Response
    })
    globalThis.fetch = fetchMock

    await resolveTemplate('auth/core/session', mockCtx)
    expect(requestedUrls.some(u => u.includes('/templates/'))).toBe(false)
  })

  it('falls back to templates/ directory when primary src/ candidate fails', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/src/templates/ui/page.ts')) {
        return {
          ok: true,
          status: 200,
          text: async () => 'export const page = true;',
        } as Response
      }
      return { ok: false, status: 404, text: async () => '' } as Response
    })
    globalThis.fetch = fetchMock

    const result = await resolveTemplate('auth/ui/page', mockCtx)
    expect(result).toBe('export const page = true;')
  })

  it('throws descriptive error if template is not found anywhere', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    } as Response)
    globalThis.fetch = fetchMock

    await expect(resolveTemplate('auth/nonexistent/file', mockCtx)).rejects.toThrow(
      'Template not found for key "auth/nonexistent/file"',
    )
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
