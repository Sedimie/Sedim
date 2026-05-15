import * as clack from '@clack/prompts'
import chalk from 'chalk'
import type { ConflictAction, DetectedContext, InstallPlan } from '../planning/types'

// ============================================================
// showDetectionSummary — what the detector found
// shows value + confidence for each field
// surfaces evidence for anything below high confidence
// ============================================================

export function showDetectionSummary(ctx: DetectedContext): void {
  const confidenceTag = (c: string) =>
    c === 'high'
      ? chalk.green('high ✓')
      : c === 'medium'
        ? chalk.yellow('medium ~')
        : chalk.red('low ?')

  const row = (label: string, value: string, confidence: string) =>
    `  ${chalk.dim(label.padEnd(14))}${chalk.white(value.padEnd(12))}${confidenceTag(confidence)}`

  const lines = [
    row('framework', ctx.framework.value, ctx.framework.confidence),
    row('orm', ctx.orm.value, ctx.orm.confidence),
    row('db', ctx.db.value, ctx.db.confidence),
    row('language', ctx.language.value, ctx.language.confidence),
    row('modules', ctx.moduleSystem.value, ctx.moduleSystem.confidence),
    row('pkg manager', ctx.packageManager, 'high'),
  ]

  // surface evidence for anything not high confidence
  const evidenceLines: string[] = []
  for (const field of [ctx.framework, ctx.orm, ctx.db, ctx.language, ctx.moduleSystem]) {
    if (field.confidence !== 'high' && field.evidence.length > 0) {
      for (const e of field.evidence) {
        evidenceLines.push(`  ${chalk.dim('↳')} ${chalk.dim(e)}`)
      }
    }
  }

  const content = [...lines, ...(evidenceLines.length ? ['', ...evidenceLines] : [])].join('\n')
  clack.note(content, chalk.bold('Detected Stack'))

  // flag conflicts prominently
  if (ctx.conflicts.existingAuthDetected) {
    clack.log.warn(
      chalk.yellow('Existing auth detected — conflicts will be reviewed before any writes.'),
    )
    for (const signal of ctx.conflicts.signals) {
      clack.log.message(chalk.dim(`  ↳ ${signal}`))
    }
  }
}

// ============================================================
// showPlanSummary — what the thinker decided to do
// shown before asking the user to confirm
// ============================================================

export function showPlanSummary(plan: InstallPlan): void {
  const lines: string[] = []

  if (plan.filesToCreate.length) {
    lines.push(chalk.bold('  create'))
    for (const f of plan.filesToCreate) {
      lines.push(`    ${chalk.green('+')} ${f.path}`)
    }
  }

  if (plan.filesToModify.length) {
    lines.push(chalk.bold('  modify'))
    for (const f of plan.filesToModify) {
      lines.push(`    ${chalk.yellow('~')} ${f.path}  ${chalk.dim(f.description)}`)
    }
  }

  if (plan.dependenciesToInstall.length) {
    lines.push(chalk.bold('  install'))
    lines.push(`    ${chalk.cyan(plan.dependenciesToInstall.join(', '))}`)
  }

  if (plan.devDependenciesToInstall.length) {
    lines.push(chalk.bold('  install (dev)'))
    lines.push(`    ${chalk.cyan(plan.devDependenciesToInstall.join(', '))}`)
  }

  if (plan.envVarsToAdd.length) {
    lines.push(chalk.bold('  env vars'))
    for (const e of plan.envVarsToAdd) {
      lines.push(`    ${chalk.magenta(e.key)}  ${chalk.dim(e.description)}`)
    }
  }

  if (plan.conflictActions.length) {
    lines.push(chalk.bold('  conflicts'))
    for (const c of plan.conflictActions) {
      lines.push(`    ${chalk.red('!')} ${c.file}  ${chalk.dim(c.description)}`)
    }
  }

  clack.note(lines.join('\n'), chalk.bold(`Plan — ${plan.moduleName}`))
}

// ============================================================
// showEndReport — post-install summary
// env vars are listed but never auto-written — user must add them
// ============================================================

export function showEndReport(plan: InstallPlan, elapsedMs: number): void {
  const elapsed = (elapsedMs / 1000).toFixed(1)
  const lines: string[] = []

  const created = plan.filesToCreate.length
  const modified = plan.filesToModify.length
  const deps = plan.dependenciesToInstall.length + plan.devDependenciesToInstall.length

  lines.push(`  ${chalk.green('✓')} ${created} file${created !== 1 ? 's' : ''} created`)
  if (modified)
    lines.push(`  ${chalk.green('✓')} ${modified} file${modified !== 1 ? 's' : ''} modified`)
  if (deps) lines.push(`  ${chalk.green('✓')} ${deps} package${deps !== 1 ? 's' : ''} installed`)

  if (plan.envVarsToAdd.length) {
    lines.push('')
    lines.push(chalk.yellow('  Add these to your .env before running:'))
    for (const e of plan.envVarsToAdd) {
      const example = e.example ? `=${e.example}` : '=...'
      lines.push(`    ${chalk.magenta(e.key)}${chalk.dim(example)}`)
    }
  }

  lines.push('')
  lines.push(chalk.dim(`  completed in ${elapsed}s`))

  clack.note(lines.join('\n'), chalk.bold.green('Done'))
}

// ============================================================
// showConflict — renders a single conflict for user decision
// called by the command layer before asking how to proceed
// ============================================================

export function showConflict(conflict: ConflictAction): void {
  const levelColor =
    conflict.level === 'full'
      ? chalk.red
      : conflict.level === 'partial'
        ? chalk.yellow
        : chalk.green

  clack.note(
    [
      `  ${chalk.bold('file')}    ${conflict.file}`,
      `  ${chalk.bold('level')}   ${levelColor(conflict.level)}`,
      `  ${chalk.bold('reason')}  ${chalk.dim(conflict.description)}`,
    ].join('\n'),
    chalk.yellow('Conflict Detected'),
  )
}

// ============================================================
// showDiff — per-file diff preview for sedim diff
// simple +/- line format, not a full git diff
// ============================================================

export function showDiff(file: string, before: string, after: string): void {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  const diffLines: string[] = []

  // naive line diff — removed lines then added lines
  // good enough for showing what changes, not a real diff algorithm
  for (const line of beforeLines) {
    if (!afterLines.includes(line)) {
      diffLines.push(chalk.red(`  - ${line}`))
    }
  }
  for (const line of afterLines) {
    if (!beforeLines.includes(line)) {
      diffLines.push(chalk.green(`  + ${line}`))
    }
  }

  if (diffLines.length === 0) {
    diffLines.push(chalk.dim('  no changes'))
  }

  clack.note(diffLines.join('\n'), chalk.bold(file))
}
