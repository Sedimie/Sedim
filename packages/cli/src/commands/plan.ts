import { isSedimInitialised } from '../config/index'
import { detect } from '../detector/index'
import { renderPlanSummary } from '../planning/diff-renderer'
import type { DetectedContext, InstallPlan, ModuleManifest } from '../planning/types'
import { findProjectRoot } from '../shared/fs'
import * as ui from '../showbaby/index'
import { buildPlan } from '../thinker/index'
import { loadModuleManifest } from '../thinker/load-module-manifest'
import { manifestToPlanConfig } from '../thinker/manifest-to-plan-config'

export async function runPlan(moduleName: string): Promise<void> {
  ui.showIntro(`plan ${moduleName}`)

  const projectRoot = await findProjectRoot()

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
    spinner.fail('Detection failed')
    ui.showError(err)
    process.exit(1)
  }

  let manifest: ModuleManifest
  const manifestSpinner = ui.createSpinner(`Fetching ${moduleName} manifest...`)
  try {
    manifest = await loadModuleManifest(moduleName)
    manifestSpinner.stop('Manifest loaded')
  } catch (err) {
    manifestSpinner.fail('Failed to load manifest')
    ui.showError(err)
    process.exit(1)
  }

  let plan: InstallPlan
  const planSpinner = ui.createSpinner('Building plan...')
  try {
    const planConfig = manifestToPlanConfig(manifest, [], ctx)
    plan = await buildPlan(ctx, planConfig, [])
    planSpinner.stop('Plan ready')
  } catch (err) {
    planSpinner.fail('Planning failed')
    ui.showError(err)
    process.exit(1)
  }

  ui.showPlanSummary(plan)
  ui.logNote(renderPlanSummary(plan), 'Plain Text Summary')
  ui.showOutro('No files written — this was a plan preview only.')
}
