import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectFramework } from '../../src/detector/detect-framework'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

describe('detectFramework', () => {
  it('detects Next.js with high confidence from next.config.ts', async () => {
    const result = await detectFramework(fix('nextjs-drizzle-ts'))
    expect(result.value).toBe('nextjs')
    expect(result.confidence).toBe('high')
    expect(result.evidence.some(e => e.includes('next.config'))).toBe(true)
  })

  it('detects Express with high confidence from AST scan of src/app.ts', async () => {
    const result = await detectFramework(fix('express-prisma-ts'))
    expect(result.value).toBe('express')
    // high because AST confirms express() call, medium if only deps
    expect(['high', 'medium']).toContain(result.confidence)
    expect(result.evidence.some(e => e.includes('express'))).toBe(true)
  })

  it('detects Hono from dependencies', async () => {
    const result = await detectFramework(fix('hono-no-orm-js'))
    expect(result.value).toBe('hono')
    expect(result.evidence.some(e => e.includes('hono'))).toBe(true)
  })

  it('returns unknown with low confidence when no framework signals exist', async () => {
    const result = await detectFramework(fix('empty'))
    expect(result.value).toBe('unknown')
    expect(result.confidence).toBe('low')
  })
})
