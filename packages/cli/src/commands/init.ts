import { buildConfig, isSedimInitialised, writeSedimConfig } from '../config/index'
import { detect } from '../detector/index'
import { bootstrapFrontendCompanion } from '../frontend/bootstrap'
import type { DetectedContext, SedimConfig } from '../planning/types'
import { MIN_NODE_VERSION } from '../shared/constants'
import { ensureProjectRoot } from '../shared/ensure-project'
import * as ui from '../showbaby/index'
import { writeAuditEntry } from '../telemetry/audit-log'
import { logger } from '../telemetry/logger'

export async function runInit(options: { force?: boolean } = {}): Promise<void> {
  ui.showBanner('init')

  // ── find project root ────────────────────────────────────
  const projectRoot = await ensureProjectRoot()
  await logger.info(projectRoot, 'init started')

  // ── node version check ───────────────────────────────────
  const nodeMajor = parseInt(process.version.slice(1))
  if (nodeMajor < MIN_NODE_VERSION) {
    ui.showError(new Error(`Node ${MIN_NODE_VERSION}+ required. You have ${process.version}.`))
    process.exit(1)
  }

  // ── already initialised? ─────────────────────────────────
  if (!options.force && (await isSedimInitialised(projectRoot))) {
    const overwrite = await ui.confirm('sedim.config.ts already exists. Reinitialise?', false)
    if (!overwrite) ui.showCancel('Init cancelled — existing config kept.')
  }

  // ── detection ────────────────────────────────────────────
  ui.logSection('Detection')
  const spinner = ui.spinDetecting()

  let ctx: DetectedContext
  try {
    ctx = await detect(projectRoot)
    spinner.stop('Stack detected')
  } catch (err) {
    spinner.stop('Detection failed')
    ui.showError(err)
    await writeAuditEntry(projectRoot, { command: 'init', status: 'failed', error: String(err) })
    process.exit(1)
  }

  ui.showDetectionSummary(ctx)

  // ── no frontend? offer to bootstrap one ──────────────────────
  if (!ctx.frontend) {
    const shouldBootstrap = await ui.showNoFrontendPrompt(ctx)
    if (shouldBootstrap) {
      const result = await bootstrapFrontendCompanion(projectRoot)
      if (result) {
        ctx.frontend = result.frontend
      }
    }
  }

  // ── resolve ambiguities ──────────────────────────────────
  // only ask about fields the detector wasn't confident about
  ui.logSection('Configuration')

  let framework = ctx.framework.value
  if (ctx.framework.confidence !== 'high') {
    framework = await ui.select('Which framework are you using?', [
      { value: 'nextjs', label: 'Next.js' },
      { value: 'express', label: 'Express' },
      { value: 'hono', label: 'Hono' },
      { value: 'fastify', label: 'Fastify' },
    ])
  }

  let orm = ctx.orm.value
  if (ctx.orm.confidence !== 'high') {
    orm = await ui.select('Which ORM are you using?', [
      { value: 'drizzle', label: 'Drizzle' },
      { value: 'prisma', label: 'Prisma' },
      { value: 'none', label: 'None' },
    ])
  }

  let db = ctx.db.value
  if (ctx.db.confidence !== 'high') {
    db = await ui.select('Which database?', [
      { value: 'postgres', label: 'PostgreSQL' },
      { value: 'mysql', label: 'MySQL' },
      { value: 'sqlite', label: 'SQLite' },
      { value: 'mongodb', label: 'MongoDB' },
    ])
  }

  const uiLevel = await ui.select('Default UI style for components?', [
    { value: 'headless', label: 'Headless', hint: 'unstyled, full control' },
    { value: 'tailwind', label: 'Tailwind', hint: 'pre-styled with tailwind' },
    { value: 'themed', label: 'Themed', hint: 'pre-built theme variants' },
  ])

  // ── write config ─────────────────────────────────────────
  const overrides: Partial<SedimConfig> = {
    framework: framework as SedimConfig['framework'],
    orm: orm as SedimConfig['orm'],
    db: db as SedimConfig['db'],
    preferences: {
      ui: uiLevel as SedimConfig['preferences']['ui'],
      confirmBeforeWrite: true,
      dryRunByDefault: false,
    },
  }

  await ui.runTasks([
    {
      title: 'Writing sedim.config.ts',
      task: async () => {
        const config = buildConfig(ctx, overrides)
        await writeSedimConfig(projectRoot, config)
        return 'sedim.config.ts written'
      },
    },
  ])

  await writeAuditEntry(projectRoot, { command: 'init', status: 'success' })
  await logger.info(projectRoot, 'init complete')

  ui.showOutro('Initialised. Run `sedim add <module>` to install your first feature.')
}
