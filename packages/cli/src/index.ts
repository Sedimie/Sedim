#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { runAdd } from './commands/add'
import { runContinue } from './commands/continue'
import { runDiff } from './commands/diff'
import { runDoctor } from './commands/doctor'
import { runInit } from './commands/init'
import { runPlan } from './commands/plan'
import { CLI_VERSION } from './shared/constants'
import * as ui from './showbaby/index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const program = new Command()

program
  .name('sedim')
  .description('Install complete features, not dependencies.')
  .version(CLI_VERSION)
  .option('--cwd <path>', 'Run as if sedim was started in <path> instead of the current directory')
  .hook('preAction', thisCommand => {
    const opts = thisCommand.opts()
    if (opts.cwd) {
      // Resolve relative to monorepo root (three levels up from packages/cli/src/)
      const cwd = path.isAbsolute(opts.cwd)
        ? opts.cwd
        : path.resolve(__dirname, '..', '..', '..', opts.cwd)
      process.chdir(cwd)
    }
  })

program
  .command('init')
  .description('Detect your stack and initialise sedim in this project')
  .option('-f, --force', 'Reinitialise even if already set up')
  .action(async opts => {
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
  .action(async module => {
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
  .action(async module => {
    await runPlan(module).catch(handleTopLevelError)
  })

program
  .command('diff <module>')
  .description('Show per-file diffs of what a module install would change')
  .action(async module => {
    await runDiff(module).catch(handleTopLevelError)
  })

function handleTopLevelError(err: unknown): void {
  ui.showError(err)
  process.exit(1)
}

program.parse()
