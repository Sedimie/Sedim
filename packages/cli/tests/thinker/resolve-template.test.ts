import { describe, expect, it } from 'vitest'
import { stripRelativeJsExtensions, resolveTemplate } from '../../src/thinker/resolve-template'
import type { DetectedContext } from '../../src/planning/types'

function makeMockCtx(): DetectedContext {
  return {
    projectRoot: '/test',
    packageManager: 'pnpm',
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
    conflicts: { level: 'none', existingAuthDetected: false, signals: [] },
  }
}

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

describe('resolveTemplate - operations barrel generation (#11)', () => {
  it('generates operations barrel with core export and fallback stubs for email-password only', async () => {
    const ctx = makeMockCtx()
    const content = await resolveTemplate('auth/adapters/framework/operations', ctx, ['email-password'])

    expect(content).toContain(`export * from './operations/core.js'`)
    expect(content).toContain(`export async function completeTotpLogin`)
    expect(content).toContain(`export async function refreshAccessToken`)
    expect(content).toContain(`export async function handleOAuthCallback`)
    expect(content).toContain(`export async function createMagicLink`)

    // Should NOT import unstamped feature operations
    expect(content).not.toContain(`export * from './operations/totp.js'`)
    expect(content).not.toContain(`export * from './operations/jwt.js'`)
    expect(content).not.toContain(`export * from './operations/oauth.js'`)
    expect(content).not.toContain(`export * from './operations/magic-link.js'`)
  })

  it('exports real feature operations when selected', async () => {
    const ctx = makeMockCtx()
    const content = await resolveTemplate(
      'auth/adapters/framework/operations',
      ctx,
      ['email-password', 'totp', 'jwt', 'oauth-github', 'magic-link', 'rbac', 'abac'],
    )

    expect(content).toContain(`export * from './operations/core.js'`)
    expect(content).toContain(`export * from './operations/totp.js'`)
    expect(content).toContain(`export * from './operations/jwt.js'`)
    expect(content).toContain(`export * from './operations/oauth.js'`)
    expect(content).toContain(`export * from './operations/magic-link.js'`)
    expect(content).toContain(`export * from './operations/rbac.js'`)
    expect(content).toContain(`export * from './operations/abac.js'`)

    // Should NOT contain fallback stubs when feature is selected
    expect(content).not.toContain(`totp-not-enabled`)
  })
})
