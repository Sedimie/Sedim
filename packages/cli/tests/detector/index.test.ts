import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detect } from '../../src/detector/index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

describe('detect (full DetectedContext)', () => {
  it('produces correct DetectedContext for nextjs-drizzle-ts fixture', async () => {
    const ctx = await detect(fix('nextjs-drizzle-ts'))

    expect(ctx.framework.value).toBe('nextjs')
    expect(ctx.framework.confidence).toBe('high')
    expect(ctx.orm.value).toBe('drizzle')
    expect(ctx.orm.confidence).toBe('high')
    expect(ctx.db.value).toBe('postgres')
    expect(ctx.language.value).toBe('typescript')
    expect(ctx.moduleSystem.value).toBe('esm')
    expect(ctx.conflicts.existingAuthDetected).toBe(false)
    expect(ctx.conflicts.level).toBe('none')
    expect(ctx.projectRoot).toBe(fix('nextjs-drizzle-ts'))
  })

  it('produces correct DetectedContext for express-prisma-ts fixture', async () => {
    const ctx = await detect(fix('express-prisma-ts'))

    expect(ctx.framework.value).toBe('express')
    expect(ctx.orm.value).toBe('prisma')
    expect(ctx.language.value).toBe('typescript')
    expect(ctx.moduleSystem.value).toBe('cjs')
  })

  it('produces correct DetectedContext for hono-no-orm-js fixture', async () => {
    const ctx = await detect(fix('hono-no-orm-js'))

    expect(ctx.framework.value).toBe('hono')
    expect(ctx.orm.value).toBe('none')
    expect(ctx.language.value).toBe('javascript')
    expect(ctx.moduleSystem.value).toBe('esm')
  })

  it('detects conflicts for nextjs-existing-auth fixture', async () => {
    const ctx = await detect(fix('nextjs-existing-auth'))

    expect(ctx.framework.value).toBe('nextjs')
    expect(ctx.conflicts.existingAuthDetected).toBe(true)
    expect(ctx.conflicts.level).toBe('partial')
    expect(ctx.conflicts.signals.length).toBeGreaterThan(0)
  })

  it('DetectedContext has all required fields', async () => {
    const ctx = await detect(fix('nextjs-drizzle-ts'))

    // shape validation — every field must be present
    expect(ctx).toHaveProperty('projectRoot')
    expect(ctx).toHaveProperty('packageManager')
    expect(ctx).toHaveProperty('language')
    expect(ctx).toHaveProperty('moduleSystem')
    expect(ctx).toHaveProperty('framework')
    expect(ctx).toHaveProperty('orm')
    expect(ctx).toHaveProperty('db')
    expect(ctx).toHaveProperty('structure')
    expect(ctx).toHaveProperty('schema')
    expect(ctx).toHaveProperty('codeArchitecture')
    expect(ctx).toHaveProperty('runtime')
    expect(ctx).toHaveProperty('conflicts')
    expect(ctx.codeArchitecture).toHaveProperty('injectionAnchors')
  })
})
