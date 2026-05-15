import * as clack from '@clack/prompts'
import chalk from 'chalk'
import { formatError } from '../shared/errors'

export interface DoctorCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
  fix?: string
}

// ============================================================
// showError — three-part format: what / why / next action
// ============================================================

export function showError(err: unknown): void {
  const { message, cause, nextAction } = formatError(err)

  clack.log.error(chalk.red(message))

  if (cause && cause !== 'No additional cause information.') {
    clack.log.message(chalk.dim(`  cause: ${cause}`))
  }

  clack.note(nextAction, chalk.yellow('next step'))
}

// ============================================================
// showDoctorReport — renders doctor command output
// each check shows pass/warn/fail with optional fix command
// ============================================================

export function showDoctorReport(checks: DoctorCheck[]): void {
  const lines = checks.map(check => {
    const icon =
      check.status === 'pass'
        ? chalk.green('✓')
        : check.status === 'warn'
          ? chalk.yellow('⚠')
          : chalk.red('✗')

    const name = chalk.bold(check.name.padEnd(24))
    const msg =
      check.status === 'fail'
        ? chalk.red(check.message)
        : check.status === 'warn'
          ? chalk.yellow(check.message)
          : chalk.dim(check.message)

    const fix = check.fix ? `\n    ${chalk.dim('fix:')} ${chalk.cyan(check.fix)}` : ''

    return `  ${icon}  ${name}${msg}${fix}`
  })

  clack.note(lines.join('\n'), chalk.bold('Doctor Report'))
}
