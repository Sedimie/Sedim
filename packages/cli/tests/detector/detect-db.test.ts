import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectDB } from '../../src/detector/detect-db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

describe('detectDB', () => {
  it('detects postgres from @neondatabase/serverless dep', async () => {
    const result = await detectDB(fix('nextjs-drizzle-ts'))
    expect(result.value).toBe('postgres')
    expect(result.confidence).toBe('high')
    expect(result.evidence.some(e => e.includes('neondatabase'))).toBe(true)
  })

  it('detects postgres from drizzle.config.ts dialect field', async () => {
    // nextjs-existing-auth also has neondatabase dep
    const result = await detectDB(fix('nextjs-existing-auth'))
    expect(result.value).toBe('postgres')
    expect(result.confidence).toBe('high')
  })

  it('returns unknown when no db signals exist', async () => {
    const result = await detectDB(fix('hono-no-orm-js'))
    expect(result.value).toBe('unknown')
    expect(result.confidence).toBe('low')
  })

  it('returns unknown for empty directory', async () => {
    const result = await detectDB(fix('empty'))
    expect(result.value).toBe('unknown')
  })
})
