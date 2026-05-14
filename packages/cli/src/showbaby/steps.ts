import * as clack from '@clack/prompts'
import chalk from 'chalk'

// ============================================================
// Spinner — wraps clack's spinner for async operations
// returns the clack SpinnerResult directly so callers can
// call .stop(), .fail(), .message() as needed
// ============================================================

export function createSpinner(message: string): clack.SpinnerResult {
  const s = clack.spinner()
  s.start(message)
  return s
}

// convenience — the most common spinner in the codebase
export function spinDetecting(): clack.SpinnerResult {
  return createSpinner('Detecting your stack...')
}

// ============================================================
// Log helpers — thin wrappers so nothing else imports clack directly
// ============================================================

export function logStep(message: string): void {
  clack.log.step(message)
}

export function logInfo(message: string): void {
  clack.log.info(message)
}

export function logSuccess(message: string): void {
  clack.log.success(message)
}

export function logWarn(message: string): void {
  clack.log.warn(message)
}

export function logError(message: string): void {
  clack.log.error(message)
}

// ============================================================
// Task runner — for sequences of async steps with live status
// wraps clack's tasks() which handles the spinner + checkmark
// pattern automatically
//
// usage:
//   await runTasks([
//     { title: 'Installing dependencies', task: () => installDeps() },
//     { title: 'Writing config', task: () => writeConfig() },
//   ])
// ============================================================

export async function runTasks(tasks: clack.Task[]): Promise<void> {
  await clack.tasks(tasks)
}

// ============================================================
// Section header — visually separates phases within a command
// e.g. "── Detection ──────────────────────────────────────"
// ============================================================

export function logSection(title: string): void {
  const line = chalk.dim('─'.repeat(Math.max(0, 48 - title.length - 2)))
  clack.log.message(chalk.dim(`── ${title} ${line}`))
}

// ============================================================
// Note box — for multi-line informational blocks
// e.g. showing what env vars need to be set after install
// ============================================================

export function logNote(message: string, title?: string): void {
  clack.note(message, title ? chalk.bold(title) : undefined)
}
