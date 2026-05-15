#!/usr/bin/env node
import { Command } from 'commander'
import { CLI_VERSION } from './shared/constants'
import { runInit } from './commands/init'
import { runAdd } from './commands/add'
import { runContinue } from './commands/continue'
import { runDoctor } from './commands/doctor'
import { runPlan } from './commands/plan'
import { runDiff } from './commands/diff'
import * as ui from './showbaby/index'

const program = new Command()

program
  .name('sedim')
  .description('Install complete features, not dependencies.')
  .version(CLI_VERSION)

program
  .command('init')
  .description('Detect your stack and initialise sedim in this project')
  .option('-f, --force', 'Reinitialise even if already set up')
  .action(async (opts) => {
    await runInit({ force: opts.force }).catch(handleTopLevelError)
  })

program
  .command('add <module>')
  .description('Install a module into your project')
  .option('--dry-run', 'Preview the plan without writing any files')
  .option('-f, --force', 'Skip conflict checks')
  .action(async (module, opts) => {
    await runAdd(module, { dryRun: opts.dryRun, force: opts.force }).catch(handleTopLevelError)
  })

program
  .command('continue [module]')
  .description('Resume an interrupted module install')
  .action(async (module) => {
    await runContinue(module).catch(handleTopLevelError)
  })

program
  .command('doctor')
  .description('Validate your setup and diagnose common issues')
  .action(async () => {
    await runDoctor().catch(handleTopLevelError)
  })

program
  .command('plan <module>')
  .description('Compute and preview the install plan without writing files')
  .action(async (module) => {
    await runPlan(module).catch(handleTopLevelError)
  })

program
  .command('diff <module>')
  .description('Show per-file diffs of what a module install would change')
  .action(async (module) => {
    await runDiff(module).catch(handleTopLevelError)
  })

function handleTopLevelError(err: unknown): void {
  ui.showError(err)
  process.exit(1)
}

program.parse()
