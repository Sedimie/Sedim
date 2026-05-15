import { isSedimInitialised, readSedimConfig } from '../config/index'
import { detect } from '../detector/index'
import type { DetectedContext, InstallPlan, ModuleManifest } from '../planning/types'
import { readSession, writeSession } from '../session/index'
import { findProjectRoot } from '../shared/fs'
import * as ui from '../showbaby/index'
import { writeAuditEntry } from '../telemetry/audit-log'
import { logger } from '../telemetry/logger'
import { buildPlan } from '../thinker/index'
import { loadModuleManifest } from '../thinker/load-module-manifest'
import { manifestToPlanConfig } from '../thinker/manifest-to-plan-config'
import { applyPlan } from '../writer/index'

export async function runAdd(
  moduleName: string,
  options: { dryRun?: boolean; force?: boolean } = {},
): Promise<void> {
  ui.showIntro(`add ${moduleName}`)
  const start = Date.now()

  const projectRoot = await findProjectRoot()
  await logger.info(projectRoot, `add ${moduleName} started`, options)

  // ── must be initialised ──────────────────────────────────
  if (!(await isSedimInitialised(projectRoot))) {
    ui.showError(new Error('Project not initialised. Run `sedim init` first.'))
    process.exit(1)
  }

  // ── check for existing session ───────────────────────────
  const existingSession = await readSession(projectRoot)
  if (existingSession?.moduleName === moduleName && existingSession.status === 'active') {
    const resume = await ui.confirm(
      `Found an interrupted session for "${moduleName}". Resume it?`,
      true,
    )
    if (resume) {
      ui.logInfo('Resuming session — run `sedim continue` for full resume flow.')
    }
  }

  // ── detection ────────────────────────────────────────────
  ui.logSection('Detection')
  const spinner = ui.spinDetecting()

  let ctx: DetectedContext
  try {
    ctx = await detect(projectRoot)
    spinner.stop('Stack detected')
  } catch (err) {
    spinner.fail('Detection failed')
    ui.showError(err)
    process.exit(1)
  }

  ui.showDetectionSummary(ctx)

  // ── load manifest ────────────────────────────────────────
  ui.logSection('Module')
  const manifestSpinner = ui.createSpinner(`Fetching ${moduleName} manifest...`)

  let manifest: ModuleManifest
  try {
    manifest = await loadModuleManifest(moduleName)
    manifestSpinner.stop(`${moduleName} manifest loaded`)
  } catch (err) {
    manifestSpinner.fail('Failed to load manifest')
    ui.showError(err)
    process.exit(1)
  }

  // ── feature selection ────────────────────────────────────
  ui.logSection('Configuration')

  const selections: Record<string, unknown> = {}

  if (manifest.features.providers?.length) {
    selections.providers = await ui.multiselect(
      'Which providers?',
      manifest.features.providers.map(p => ({ value: p, label: p })),
    )
  }

  if (manifest.features.ui?.length) {
    selections.ui = await ui.select(
      'UI style?',
      manifest.features.ui.map(u => ({ value: u, label: u })),
    )
  }

  if (manifest.features.authorization?.length) {
    selections.authorization = await ui.select(
      'Authorization model?',
      manifest.features.authorization.map(a => ({ value: a, label: a })),
    )
  }

  // ── build plan ───────────────────────────────────────────
  ui.logSection('Planning')
  const planSpinner = ui.createSpinner('Building install plan...')

  // selectedFeatures is the flat list of what the user picked
  const selectedFeatures = [
    ...((selections.providers as string[]) ?? []),
    ...((selections.ui as string[]) ? [selections.ui as string] : []),
    ...((selections.authorization as string[]) ? [selections.authorization as string] : []),
  ]

  // convert manifest to PlanConfig — real modules will provide their own
  const planConfig = manifestToPlanConfig(manifest, selectedFeatures, ctx)

  let plan: InstallPlan
  try {
    plan = await buildPlan(ctx, planConfig, selectedFeatures)
    planSpinner.stop('Plan ready')
  } catch (err) {
    planSpinner.fail('Planning failed')
    ui.showError(err)
    process.exit(1)
  }

  ui.showPlanSummary(plan)

  if (options.dryRun) {
    ui.logNote('Dry run — no files written.', 'Dry Run')
    ui.showOutro('Dry run complete.')
    return
  }

  // ── resolve pending conflicts before writing ─────────────
  // any conflict still marked pending-user-choice must be resolved
  // before the writer runs — writer only executes, never decides
  const pendingConflicts = plan.conflictActions.filter(c => c.resolution === 'pending-user-choice')

  if (pendingConflicts.length > 0 && !options.force) {
    ui.logSection('Conflicts')

    for (const conflict of pendingConflicts) {
      ui.showConflict(conflict)

      if (conflict.level === 'full') {
        ui.logWarn('Full conflict detected — cannot proceed without --force.')
        ui.showCancel('Cancelled — no files written.')
      }

      const resolution = await ui.select<'skip' | 'overwrite'>(
        `How to handle "${conflict.file}"?`,
        [
          { value: 'skip', label: 'Skip', hint: 'leave the existing file untouched' },
          { value: 'overwrite', label: 'Overwrite', hint: 'replace with the new version' },
        ],
      )
      conflict.resolution = resolution
    }
  }

  // ── confirm before write ─────────────────────────────────
  const proceed = await ui.confirm('Apply this plan?', true)
  if (!proceed) {
    ui.showCancel('Cancelled — no files written.')
  }

  // ── save session before writing ──────────────────────────
  await writeSession(projectRoot, {
    moduleName,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    currentStep: 'writer:start',
    completedSteps: ['detector', 'thinker'],
    selectedOptions: selections,
    planSnapshot: plan,
    status: 'active',
  })

  // ── apply plan ───────────────────────────────────────────
  ui.logSection('Writing')

  try {
    await applyPlan(projectRoot, plan)
  } catch (err) {
    ui.showError(err)
    await writeAuditEntry(projectRoot, {
      command: 'add',
      module: moduleName,
      status: 'failed',
      error: String(err),
    })
    ui.logWarn('Session preserved — run `sedim continue` to retry.')
    process.exit(1)
  }

  await writeAuditEntry(projectRoot, {
    command: 'add',
    module: moduleName,
    filesCreated: plan.filesToCreate.map(f => f.path),
    filesModified: plan.filesToModify.map(f => f.path),
    status: 'success',
  })

  ui.showEndReport(plan, Date.now() - start)
  ui.showOutro(`${moduleName} installed.`)
}
