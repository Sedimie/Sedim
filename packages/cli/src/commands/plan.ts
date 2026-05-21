import { isSedimInitialised } from '../config/index'
import { detect } from '../detector/index'
import type { DetectedContext, InstallPlan, ModuleManifest } from '../planning/types'
import { ensureProjectRoot } from '../shared/ensure-project'
import * as ui from '../showbaby/index'
import { buildPlan } from '../thinker/index'
import { loadModuleManifest } from '../thinker/load-module-manifest'
import { loadPlanConfig } from '../thinker/load-plan-config'

export async function runPlan(moduleName: string): Promise<void> {
  ui.showBanner(`plan ${moduleName}`)

  const projectRoot = await ensureProjectRoot()

  if (!(await isSedimInitialised(projectRoot))) {
    ui.showError(new Error('Run `sedim init` first.'))
    process.exit(1)
  }

  let ctx: DetectedContext
  const spinner = ui.spinDetecting()
  try {
    ctx = await detect(projectRoot)
    spinner.stop('Stack detected')
  } catch (err) {
    spinner.stop('Detection failed')
    ui.showError(err)
    process.exit(1)
  }

  ui.showDetectionSummary(ctx)

  let manifest: ModuleManifest
  const manifestSpinner = ui.createSpinner(`Fetching ${moduleName} manifest...`)
  try {
    manifest = await loadModuleManifest(moduleName)
    manifestSpinner.stop('Manifest loaded')
  } catch (err) {
    manifestSpinner.stop('Failed to load manifest')
    ui.showError(err)
    process.exit(1)
  }

  const planSpinner = ui.createSpinner('Building plan...')

  // Flatten all feature categories from the manifest so plan shows the full possible plan.
  // plan-config uses selectedFeatures to gate conditional templates (RBAC, JWT, UI, etc.)
  const allManifestFeatures = [
    ...(manifest.features.providers ?? []),
    ...(manifest.features.authorization ?? []),
    ...(manifest.features.session ?? []),
    ...(manifest.features.ui ?? []),
  ]

  let planConfig: import('../planning/types').PlanConfig
  try {
    planConfig = await loadPlanConfig(moduleName, manifest, ctx, allManifestFeatures)
  } catch (err) {
    planSpinner.stop('Planning failed')
    ui.showError(err)
    process.exit(1)
  }

  // Fail fast for unsupported stacks — don't build a plan we can't use
  const unsupported = (planConfig as unknown as Record<string, unknown>)['_unsupportedReasons'] as
    | string[]
    | undefined
  if (unsupported?.length) {
    planSpinner.stop('Unsupported stack')
    for (const reason of unsupported) {
      ui.logError(reason)
    }
    ui.showCancel(
      'Cannot proceed — use a supported stack (Next.js, Express, or Hono with Drizzle or Prisma).',
    )
  }

  let plan: InstallPlan
  try {
    plan = await buildPlan(ctx, planConfig, allManifestFeatures)
    planSpinner.stop('Plan ready')
  } catch (err) {
    planSpinner.stop('Planning failed')
    ui.showError(err)
    process.exit(1)
  }

  ui.showPlanSummary(plan)
  ui.showOutro('No files written — this was a plan preview only.')
}
