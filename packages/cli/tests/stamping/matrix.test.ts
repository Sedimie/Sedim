import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detect } from '../../src/detector/index'
import { buildPlan } from '../../src/thinker/build-plan'
import { createAuthPlanConfig } from '../../../../packages/auth/src/plan-config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

describe('Stamping Matrix across Playground Fixtures', () => {
  it('stamps Next.js + Drizzle fixture with zero conflicts and valid structure', async () => {
    const fixturePath = fix('nextjs-drizzle-ts')
    const ctx = await detect(fixturePath)

    expect(ctx.framework.value).toBe('nextjs')
    expect(ctx.orm.value).toBe('drizzle')
    expect(ctx.language.value).toBe('typescript')

    const planConfig = createAuthPlanConfig(ctx, ['email-password'])
    const plan = await buildPlan(ctx, planConfig, ['email-password'])

    expect(plan.moduleName).toBe('auth')
    expect(plan.filesToCreate.length).toBeGreaterThan(0)

    const createdPaths = plan.filesToCreate.map(f => f.path.replace(/\\/g, '/'))
    expect(createdPaths).toContain('src/sedim/auth/core/hash-password.ts')
    expect(createdPaths).toContain('src/sedim/auth/core/session.ts')
    expect(createdPaths).toContain('src/sedim/auth/core/email-transport.ts')
    expect(createdPaths).toContain('src/sedim/auth/adapters/framework/nextjs.ts')
    expect(createdPaths).toContain('src/sedim/auth/schema.ts')

    // Conflict safety check
    const fatalConflicts = plan.conflictActions.filter(c => c.action === 'abort')
    expect(fatalConflicts.length).toBe(0)
  })

  it('stamps Express + Prisma fixture with route injections and schema', async () => {
    const fixturePath = fix('express-prisma-ts')
    const ctx = await detect(fixturePath)

    expect(ctx.framework.value).toBe('express')
    expect(ctx.orm.value).toBe('prisma')
    expect(ctx.language.value).toBe('typescript')

    const planConfig = createAuthPlanConfig(ctx, ['email-password'])
    const plan = await buildPlan(ctx, planConfig, ['email-password'])

    expect(plan.moduleName).toBe('auth')
    expect(plan.filesToCreate.length).toBeGreaterThan(0)

    const createdPaths = plan.filesToCreate.map(f => f.path.replace(/\\/g, '/'))
    expect(createdPaths).toContain('src/sedim/auth/adapters/framework/express.ts')
    expect(createdPaths).toContain('src/sedim/auth/adapters/prisma.ts')
    expect(createdPaths).toContain('src/sedim/auth/schema.prisma')

    // Injections targeted into Express app entrypoint
    expect(plan.injectionActions.length).toBeGreaterThan(0)
    const entrypointInjections = plan.injectionActions.filter(
      i => i.file === 'src/app.ts' || i.file.endsWith('app.ts'),
    )
    expect(entrypointInjections.length).toBeGreaterThan(0)
  })

  it('correctly catches unsupported configurations on plain JS fixtures', async () => {
    const fixturePath = fix('hono-no-orm-js')
    const ctx = await detect(fixturePath)

    expect(ctx.framework.value).toBe('hono')
    expect(ctx.orm.value).toBe('none')
    expect(ctx.language.value).toBe('javascript')

    const planConfig = createAuthPlanConfig(ctx, ['email-password']) as any
    expect(planConfig._unsupportedReasons).toBeDefined()
    expect(planConfig._unsupportedReasons.length).toBeGreaterThan(0)
    expect(
      planConfig._unsupportedReasons.some((r: string) => r.includes('No ORM detected')),
    ).toBe(true)
  })

  it('stamps themed auth forms into Next.js without conflicts', async () => {
    const fixturePath = fix('nextjs-drizzle-ts')
    const ctx = await detect(fixturePath)

    const planConfig = createAuthPlanConfig(ctx, ['email-password', 'themed', 'modern'])
    const plan = await buildPlan(ctx, planConfig, ['email-password', 'themed', 'modern'])

    const createdPaths = plan.filesToCreate.map(f => f.path.replace(/\\/g, '/'))
    expect(createdPaths).toContain('src/sedim/auth/ui/tokens.css')
    expect(createdPaths).toContain('src/sedim/auth/ui/LoginForm.tsx')
    expect(createdPaths).toContain('src/sedim/auth/ui/SignupForm.tsx')
  })
})
