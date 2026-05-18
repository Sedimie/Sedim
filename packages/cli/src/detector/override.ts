import { buildConfig, writeSedimConfig } from '../config/index.js'
import type { DetectedContext } from '../planning/types.js'
import * as ui from '../showbaby/index.js'

export async function verifyAndOverrideDetection(ctx: DetectedContext): Promise<DetectedContext> {
  const envCorrect = await ui.confirm('Does this environment look correct?', true)
  if (envCorrect) return ctx

  const loopCtx = { ...ctx }

  while (true) {
    const wrong = await ui.select('What needs to be corrected?', [
      { value: 'framework', label: 'Framework', hint: `currently ${loopCtx.framework.value}` },
      { value: 'orm', label: 'ORM', hint: `currently ${loopCtx.orm.value}` },
      { value: 'db', label: 'Database', hint: `currently ${loopCtx.db.value}` },
      { value: 'done', label: 'Done', hint: 'Save config and continue' },
      { value: 'cancel', label: 'Cancel', hint: 'Exit CLI' },
    ])

    if (wrong === 'cancel') {
      ui.showCancel('Operation cancelled. Run `sedim init` to completely reconfigure.')
      process.exit(0)
    }

    if (wrong === 'done') {
      const config = buildConfig(loopCtx)
      await writeSedimConfig(loopCtx.projectRoot, config)
      ui.logNote('Configuration updated and saved back to sedim.config.ts.')
      return loopCtx
    }

    if (wrong === 'framework') {
      const framework = await ui.select('Correct Framework:', [
        { value: 'nextjs', label: 'Next.js' },
        { value: 'express', label: 'Express' },
        { value: 'hono', label: 'Hono' },
        { value: 'fastify', label: 'Fastify' },
      ])
      loopCtx.framework = {
        value: framework as Exclude<DetectedContext['framework']['value'], 'unknown'>,
        confidence: 'high',
        evidence: ['manual override'],
      }
    }

    if (wrong === 'orm') {
      const orm = await ui.select('Correct ORM:', [
        { value: 'drizzle', label: 'Drizzle' },
        { value: 'prisma', label: 'Prisma' },
        { value: 'none', label: 'None' },
      ])
      loopCtx.orm = {
        value: orm as Exclude<DetectedContext['orm']['value'], 'unknown'>,
        confidence: 'high',
        evidence: ['manual override'],
      }
    }

    if (wrong === 'db') {
      const db = await ui.select('Correct Database:', [
        { value: 'postgres', label: 'PostgreSQL' },
        { value: 'mysql', label: 'MySQL' },
        { value: 'sqlite', label: 'SQLite' },
        { value: 'mongodb', label: 'MongoDB' },
      ])
      loopCtx.db = {
        value: db as Exclude<DetectedContext['db']['value'], 'unknown'>,
        confidence: 'high',
        evidence: ['manual override'],
      }
    }

    ui.showDetectionSummary(loopCtx)
  }
}
