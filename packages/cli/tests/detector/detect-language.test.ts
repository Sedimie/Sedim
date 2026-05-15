import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectLanguage, detectModuleSystem } from '../../src/detector/detect-language'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

describe('detectLanguage', () => {
  it('detects TypeScript with high confidence from tsconfig.json', async () => {
    const result = await detectLanguage(fix('nextjs-drizzle-ts'))
    expect(result.value).toBe('typescript')
    expect(result.confidence).toBe('high')
    expect(result.evidence.some(e => e.includes('tsconfig'))).toBe(true)
  })

  it('detects JavaScript when no tsconfig exists', async () => {
    const result = await detectLanguage(fix('hono-no-orm-js'))
    expect(result.value).toBe('javascript')
  })

  it('returns javascript for empty directory', async () => {
    const result = await detectLanguage(fix('empty'))
    expect(result.value).toBe('javascript')
  })
})

describe('detectModuleSystem', () => {
  it('detects ESM from tsconfig module field', async () => {
    const result = await detectModuleSystem(fix('nextjs-drizzle-ts'))
    expect(result.value).toBe('esm')
  })

  it('detects CJS from tsconfig commonjs module field', async () => {
    const result = await detectModuleSystem(fix('express-prisma-ts'))
    expect(result.value).toBe('cjs')
  })

  it('detects ESM from package.json type:module', async () => {
    const result = await detectModuleSystem(fix('hono-no-orm-js'))
    expect(result.value).toBe('esm')
    expect(result.confidence).toBe('high')
  })
})
