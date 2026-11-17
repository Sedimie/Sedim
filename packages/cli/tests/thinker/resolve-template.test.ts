import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  findLocalMonorepoPackageDir,
  resolveTemplate,
  stripRelativeJsExtensions,
  tryResolveLocalTemplate,
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

describe('local-first template resolution (fixes #8)', () => {
  afterEach(() => {
    delete process.env.SEDIM_PACKAGES_DIR
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

  it('detects local monorepo package directory for auth', () => {
    const dir = findLocalMonorepoPackageDir('auth')
    expect(dir).toBeDefined()
    expect(dir).toContain('auth')
  })

  it('resolves local template directly from filesystem without network call', async () => {
    // If local resolution works, fetch is never called
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const localContent = await tryResolveLocalTemplate('auth', 'core/session')
    expect(localContent).toBeDefined()
    expect(typeof localContent).toBe('string')
    expect(localContent).toContain('validateSession')

    // Fetch should not be called at all
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('resolveTemplate prioritizes local files over remote fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const ctx = makeMockCtx()
    const content = await resolveTemplate('auth/core/session', ctx, [])
    expect(content).toContain('validateSession')

    // No network requests triggered
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falls back to remote fetch when local template does not exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('export const customRemote = true', { status: 200 }),
    )

    const ctx = makeMockCtx()
    const content = await resolveTemplate('auth/custom/non-existent-local', ctx, [])
    expect(content).toContain('export const customRemote = true')
  })
})
