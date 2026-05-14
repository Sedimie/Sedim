import * as ui from '../showbaby/index'
import { detect } from '../detector/index'
import { isSedimInitialised } from '../config/index'
import { loadModuleManifest } from '../thinker/load-module-manifest'
import { buildPlan } from '../thinker/index'
import { findProjectRoot, exists, readText } from '../shared/fs'
import path from 'node:path'

export async function runDiff(moduleName: string): Promise<void> {
  ui.showIntro(`diff ${moduleName}`)

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

  const manifest = await loadModuleManifest(moduleName).catch(err => {
    ui.showError(err)
    process.exit(1)
  })

  const plan = await buildPlan(ctx, manifest, {}).catch(err => {
    ui.showError(err)
    process.exit(1)
  })

  ui.logSection('File Diffs')

  // for files to modify — show before/after diff
  for (const file of plan.filesToModify) {
    const filePath = path.join(projectRoot, file.path)
    if (await exists(filePath)) {
      const before = await readText(filePath)
      // after content comes from the plan's injection actions for this file
      const injections = plan.injectionActions.filter(a => a.file === file.path)
      let after = before
      for (const injection of injections) {
        after = after.replace(injection.anchor, injection.position === 'after'
          ? `${injection.anchor}\n${injection.payload}`
          : `${injection.payload}\n${injection.anchor}`
        )
      }
      ui.showDiff(file.path, before, after)
    }
  }

  // for files to create — show the full content as additions
  for (const file of plan.filesToCreate) {
    if (file.content) {
      ui.showDiff(file.path, '', file.content)
    } else {
      ui.logInfo(`+ ${file.path} (new file — content generated at write time)`)
    }
  }

  ui.showOutro('No files written — this was a diff preview only.')
}
