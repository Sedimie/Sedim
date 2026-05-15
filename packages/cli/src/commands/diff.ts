import path from 'node:path'
import { isSedimInitialised } from '../config/index'
import { detect } from '../detector/index'
import type { DetectedContext, InstallPlan, ModuleManifest } from '../planning/types'
import { exists, findProjectRoot, readText } from '../shared/fs'
import * as ui from '../showbaby/index'
import { buildPlan } from '../thinker/index'
import { loadModuleManifest } from '../thinker/load-module-manifest'
import { manifestToPlanConfig } from '../thinker/manifest-to-plan-config'

export async function runDiff(moduleName: string): Promise<void> {
  ui.showIntro(`diff ${moduleName}`)

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
  try {
    manifest = await loadModuleManifest(moduleName)
  } catch (err) {
    ui.showError(err)
    process.exit(1)
  }

  let plan: InstallPlan
  try {
    const planConfig = manifestToPlanConfig(manifest, [], ctx)
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
        after = after.replace(
          injection.anchor,
          injection.position === 'after'
            ? `${injection.anchor}\n${injection.payload}`
            : `${injection.payload}\n${injection.anchor}`,
        )
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
