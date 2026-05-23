import * as clack from '@clack/prompts'
import chalk from 'chalk'
import figlet from 'figlet'
import { CLI_VERSION } from '../shared/constants'

// the sedim wordmark — shown once at the start of every command
const WORDMARK = chalk.bold.white('sedim') + chalk.dim(` v${CLI_VERSION}`)
const TAGLINE = chalk.dim('install complete features, not dependencies')

export function showIntro(command: string): void {
  clack.intro(`${WORDMARK}  ${chalk.dim('·')}  ${chalk.cyan(command)}`)
  clack.log.message(TAGLINE)
}

// ============================================================
// Claude CLI style banner — bold wordmark with colored border
// ============================================================

export function showBanner(command: string): void {
  const c = chalk
  const cyan = c.bold.cyan
  const white = c.bold.white

  // Render SEDIM in big ASCII art
  const art = figlet.textSync('SEDIM', {
    font: 'Block',
    horizontalLayout: 'full',
  })

  // Split into lines and wrap with cyan border + pipe
  const artLines = art.split('\n')
  const border = cyan('│')

  // Top and bottom borders
  console.log(cyan('┌────────────────────────────────────────────────────────────┐'))

  for (const line of artLines) {
    // Pad to fit inside the 60-char box, align to left
    const padded = line.padEnd(58).slice(0, 58)
    console.log(`${border} ${white(padded)} ${border}`)
  }

  console.log(cyan('└────────────────────────────────────────────────────────────┘'))

  console.log()
  // Command pill
  const tag = c.bgCyan.black(` ${command} `)
  console.log(`  ${tag}  ${c.dim.cyan('install complete features, not dependencies')}`)
  console.log()
}

export function showOutro(message: string): void {
  clack.outro(chalk.green(message))
}

// user hit ctrl+c or we're bailing cleanly — not an error
export function showCancel(message = 'Cancelled.'): never {
  clack.cancel(chalk.dim(message))
  process.exit(0)
}
