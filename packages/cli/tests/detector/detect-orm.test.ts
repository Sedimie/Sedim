import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectORM } from '../../src/detector/detect-orm'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

describe('detectORM', () => {
  it('detects Drizzle with high confidence from drizzle.config.ts', async () => {
    const result = await detectORM(fix('nextjs-drizzle-ts'))
    expect(result.value).toBe('drizzle')
    expect(result.confidence).toBe('high')
    expect(result.evidence.some(e => e.includes('drizzle.config'))).toBe(true)
  })

  it('detects Prisma with high confidence from prisma/schema.prisma', async () => {
    const result = await detectORM(fix('express-prisma-ts'))
    expect(result.value).toBe('prisma')
    expect(result.confidence).toBe('high')
    expect(result.evidence.some(e => e.includes('prisma'))).toBe(true)
  })

  it('returns none with high confidence when no ORM deps exist', async () => {
    const result = await detectORM(fix('hono-no-orm-js'))
    expect(result.value).toBe('none')
    expect(result.confidence).toBe('high')
  })

  it('returns unknown for empty directory', async () => {
    const result = await detectORM(fix('empty'))
    expect(result.value).toBe('unknown')
  })
})
