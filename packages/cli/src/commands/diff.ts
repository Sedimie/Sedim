import path from 'node:path'
import { isSedimInitialised } from '../config/index'
import { detect } from '../detector/index'
import type { DetectedContext, InstallPlan, ModuleManifest } from '../planning/types'
import { ensureProjectRoot } from '../shared/ensure-project'
import { exists, readText } from '../shared/fs'
import * as ui from '../showbaby/index'
import { buildPlan } from '../thinker/index'
import { loadModuleManifest } from '../thinker/load-module-manifest'
import { loadPlanConfig } from '../thinker/load-plan-config'
import { applyInjection } from '../writer/inject-code'

export async function runDiff(moduleName: string): Promise<void> {
  ui.showIntro(`diff ${moduleName}`)

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

  let manifest: ModuleManifest
  try {
    manifest = await loadModuleManifest(moduleName)
  } catch (err) {
    ui.showError(err)
    process.exit(1)
  }

  let plan: InstallPlan
  try {
    const planConfig = await loadPlanConfig(moduleName, manifest, ctx, [])
    plan = await buildPlan(ctx, planConfig, [])
  } catch (err) {
    ui.showError(err)
    process.exit(1)
  }

  ui.logSection('File Diffs')

  for (const file of plan.filesToModify) {
    const filePath = path.join(projectRoot, file.path)
    if (await exists(filePath)) {
      const before = await readText(filePath)
      const injections = plan.injectionActions.filter(a => a.file === file.path)
      let after = before
      for (const injection of injections) {
        try {
          after = applyInjection(after, injection)
        } catch {
          // If anchor fails, gracefully show it in the diff as a failure or skip.
          ui.logWarn(
            `Could not simulate injection in ${file.path} for diff preview (anchor not found)`,
          )
        }
      }
      ui.showDiff(file.path, before, after)
    }
  }

  for (const file of plan.filesToCreate) {
    if (file.content) {
      ui.showDiff(file.path, '', file.content)
    } else {
      ui.logInfo(`+ ${file.path} (new file — content generated at write time)`)
    }
  }

  ui.showOutro('No files written — this was a diff preview only.')
}
