import * as clack from '@clack/prompts'
import chalk from 'chalk'
import { CLI_VERSION } from '../shared/constants'

// the sedim wordmark — shown once at the start of every command
const WORDMARK = chalk.bold.white('sedim') + chalk.dim(` v${CLI_VERSION}`)
const TAGLINE = chalk.dim('install complete features, not dependencies')

export function showIntro(command: string): void {
  clack.intro(`${WORDMARK}  ${chalk.dim('·')}  ${chalk.cyan(command)}`)
  clack.log.message(TAGLINE)
}

export function showOutro(message: string): void {
  clack.outro(chalk.green(message))
}

// user hit ctrl+c or we're bailing cleanly — not an error
export function showCancel(message = 'Cancelled.'): never {
  clack.cancel(chalk.dim(message))
  process.exit(0)
}
