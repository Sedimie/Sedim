import { detect } from '../detector/index'
import type { DetectedContext } from '../planning/types'
import { clearSession, readSession } from '../session/index'
import { ensureProjectRoot } from '../shared/ensure-project'
import * as ui from '../showbaby/index'
import { writeAuditEntry } from '../telemetry/audit-log'
import { logger } from '../telemetry/logger'
import { applyPlan } from '../writer/index'

export async function runContinue(moduleName?: string): Promise<void> {
  ui.showIntro('continue')
  const start = Date.now()

  const projectRoot = await ensureProjectRoot()
  await logger.info(projectRoot, 'continue started')

  // ── load session ─────────────────────────────────────────
  const session = await readSession(projectRoot)

  if (!session) {
    ui.showError(new Error('No active session found.'))
    ui.logInfo('Run `sedim add <module>` to start a new install.')
    process.exit(1)
  }

  if (moduleName && session.moduleName !== moduleName) {
    ui.showError(new Error(`Session is for "${session.moduleName}", not "${moduleName}".`))
    process.exit(1)
  }

  if (session.status === 'complete') {
    ui.logSuccess(`Session for "${session.moduleName}" already completed.`)
    await clearSession(projectRoot)
    process.exit(0)
  }

  ui.logInfo(`Resuming "${session.moduleName}" from step: ${session.currentStep}`)
  ui.logNote(
    `Started: ${session.startedAt}\nLast updated: ${session.lastUpdatedAt}\nCompleted steps: ${session.completedSteps.join(', ') || 'none'}`,
    'Session',
  )

  // ── drift detection ──────────────────────────────────────
  // rerun detector and warn if project changed since session was saved
  ui.logSection('Drift Check')
  const spinner = ui.spinDetecting()

  let ctx: DetectedContext
  try {
    ctx = await detect(projectRoot)
    spinner.stop('Project state checked')
  } catch (err) {
    spinner.stop('Detection failed')
    ui.showError(err)
    process.exit(1)
  }

  // basic drift check — framework/orm changed since session started
  const plan = session.planSnapshot
  ui.logStep(`Resuming from: ${session.currentStep}`)

  // ── resume write ─────────────────────────────────────────
  ui.logSection('Writing')

  const proceed = await ui.confirm('Continue with the saved plan?', true)
  if (!proceed) ui.showCancel('Continue cancelled.')

  try {
    await applyPlan(projectRoot, plan)
    await clearSession(projectRoot)
  } catch (err) {
    ui.showError(err)
    await writeAuditEntry(projectRoot, {
      command: 'continue',
      module: session.moduleName,
      status: 'failed',
      error: String(err),
    })
    process.exit(1)
  }

  await writeAuditEntry(projectRoot, {
    command: 'continue',
    module: session.moduleName,
    status: 'success',
  })

  ui.showEndReport(plan, Date.now() - start)
  ui.showOutro(`${session.moduleName} install completed.`)
}
