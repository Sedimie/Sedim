import { describe, expect, it } from 'vitest'
import { stripRelativeJsExtensions } from '../../src/thinker/resolve-template'

describe('stripRelativeJsExtensions', () => {
  it('strips .js from static imports and re-exports', () => {
    const input = `
import { foo } from './foo.js'
import { bar } from '../bar.js'
export { baz } from './baz.js'
`
    const expected = `
import { foo } from './foo'
import { bar } from '../bar'
export { baz } from './baz'
`
    expect(stripRelativeJsExtensions(input)).toBe(expected)
  })

  it('strips .js from dynamic imports', () => {
    const input = `
const m = await import('../../core/oidc.js')
const router = await import('./router.js')
`
    const expected = `
const m = await import('../../core/oidc')
const router = await import('./router')
`
    expect(stripRelativeJsExtensions(input)).toBe(expected)
  })

  it('strips .js from side-effect imports', () => {
    const input = `import './polyfill.js'`
    const expected = `import './polyfill'`
    expect(stripRelativeJsExtensions(input)).toBe(expected)
  })

  it('does not touch third-party package imports', () => {
    const input = `
import argon2 from 'argon2'
import { sha256 } from '@oslojs/crypto/sha2'
const pkg = await import('drizzle-orm/neon-http')
`
    expect(stripRelativeJsExtensions(input)).toBe(input)
  })
})
