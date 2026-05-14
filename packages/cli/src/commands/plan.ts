import * as ui from '../showbaby/index'
import { detect } from '../detector/index'
import { isSedimInitialised } from '../config/index'
import { loadModuleManifest } from '../thinker/load-module-manifest'
import { buildPlan } from '../thinker/index'
import { findProjectRoot } from '../shared/fs'
import { renderPlanSummary } from '../planning/diff-renderer'

export async function runPlan(moduleName: string): Promise<void> {
  ui.showIntro(`plan ${moduleName}`)

  const projectRoot = await findProjectRoot()

  if (!(await isSedimInitialised(projectRoot))) {
    ui.showError(new Error('Run `sedim init` first.'))
    process.exit(1)
  }

  const spinner = ui.spinDetecting()
  const ctx = await detect(projectRoot).catch(err => {
    spinner.fail('Detection failed')
    ui.showError(err)
    process.exit(1)
  })
  spinner.stop('Stack detected')

  const manifestSpinner = ui.createSpinner(`Fetching ${moduleName} manifest...`)
  const manifest = await loadModuleManifest(moduleName).catch(err => {
    manifestSpinner.fail('Failed to load manifest')
    ui.showError(err)
    process.exit(1)
  })
  manifestSpinner.stop('Manifest loaded')

  // plan with empty selections — shows the default plan
  const planSpinner = ui.createSpinner('Building plan...')
  const plan = await buildPlan(ctx, manifest, {}).catch(err => {
    planSpinner.fail('Planning failed')
    ui.showError(err)
    process.exit(1)
  })
  planSpinner.stop('Plan ready')

  ui.showPlanSummary(plan)
  ui.logNote(renderPlanSummary(plan), 'Plain Text Summary')
  ui.showOutro('No files written — this was a plan preview only.')
}
