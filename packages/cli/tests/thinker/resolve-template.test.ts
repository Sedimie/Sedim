import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearTemplateCache,
  getTemplateCacheSize,
  resolveTemplate,
  resolveTemplates,
  stripRelativeJsExtensions,
  tryFetch,
} from '../../src/thinker/resolve-template'
import type { DetectedContext } from '../../src/planning/types'

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

describe('templateFetchCache & concurrent resolution (fixes #9)', () => {
  beforeEach(() => {
    clearTemplateCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    clearTemplateCache()
    vi.restoreAllMocks()
  })

  function makeMockCtx(): DetectedContext {
    return {
      framework: { value: 'nextjs', confidence: 1, signals: [] },
      orm: { value: 'drizzle', confidence: 1, signals: [] },
      db: { value: 'pg', confidence: 1, signals: [] },
      language: { value: 'typescript', confidence: 1, signals: [] },
      moduleSystem: { value: 'esm', confidence: 1, signals: [] },
      structure: { srcDir: 'src', apiDir: 'src/app/api', routeEntrypoints: [] },
      codeArchitecture: {
        pattern: 'app-router',
        apiDir: 'src/app/api',
        componentsDir: 'src/components',
        appEntrypoint: null,
      },
      hasSrcDir: true,
      hasTailwind: true,
      existingAuth: null,
      frontend: null,
    }
  }

  it('in-run cache eliminates duplicate network round-trips for the same URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.endsWith('auth/src/core/session.ts')) {
        return new Response('export const session = 1', { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    const targetUrl = 'https://raw.github.com/mock/auth/src/core/session.ts'
    const res1 = await tryFetch(targetUrl)
    const res2 = await tryFetch(targetUrl)
    const res3 = await tryFetch(targetUrl)

    expect(res1).toBe('export const session = 1')
    expect(res2).toBe('export const session = 1')
    expect(res3).toBe('export const session = 1')

    // Fetch should only be invoked once for the identical URL
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(getTemplateCacheSize()).toBe(1)

    // Clear cache resets the in-run memoization
    clearTemplateCache()
    expect(getTemplateCacheSize()).toBe(0)
  })

  it('concurrently probes candidate URLs preserving precedence order', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.endsWith('src/core/hash.ts')) {
        return new Response('export const hash = "primary"', { status: 200 })
      }
      if (urlStr.endsWith('src/templates/core/hash.ts')) {
        return new Response('export const hash = "template-fallback"', { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    const ctx = makeMockCtx()
    const content = await resolveTemplate('auth/core/hash', ctx, [])
    expect(content).toContain('export const hash = "primary"')
  })

  it('falls back to templates/ directory when source path is 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.endsWith('src/templates/ui/button.ts')) {
        return new Response('export const Button = () => null', { status: 200 })
      }
      return new Response('Not found', { status: 404 })
    })

    const ctx = makeMockCtx()
    const content = await resolveTemplate('auth/ui/button', ctx, [])
    expect(content).toContain('export const Button = () => null')
  })

  it('resolveTemplates concurrently resolves multiple template keys', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = String(url)
      if (urlStr.endsWith('src/core/one.ts')) return new Response('export const one = 1', { status: 200 })
      if (urlStr.endsWith('src/core/two.ts')) return new Response('export const two = 2', { status: 200 })
      return new Response('Not found', { status: 404 })
    })

    const ctx = makeMockCtx()
    const results = await resolveTemplates(['auth/core/one', 'auth/core/two'], ctx, [])

    expect(results.get('auth/core/one')).toContain('export const one = 1')
    expect(results.get('auth/core/two')).toContain('export const two = 2')
  })
})
