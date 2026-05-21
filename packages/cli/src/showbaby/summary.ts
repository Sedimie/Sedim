import * as clack from '@clack/prompts'
import chalk from 'chalk'
import { diffLines } from 'diff'
import type { ConflictAction, DetectedContext, InstallPlan } from '../planning/types'

// ============================================================
// showDetectionSummary — Claude CLI style with colored sections
// ============================================================

function detectionRow(label: string, value: string, confidence: string): string {
  const confidenceTag =
    confidence === 'high'
      ? chalk.green('✓')
      : confidence === 'medium'
        ? chalk.yellow('~')
        : chalk.red('?')
  const confidenceColor =
    confidence === 'high' ? chalk.green : confidence === 'medium' ? chalk.yellow : chalk.red
  const tag = confidenceColor(` ${confidence} `)
  return `  ${chalk.dim(label.padEnd(14))}${chalk.white(value.padEnd(12))}${tag}`
}

export function showDetectionSummary(ctx: DetectedContext): void {
  console.log()
  console.log(`  ${chalk.bgBlue.black(' 🔍  Detected Stack ')}`)
  console.log()

  const lines = [
    detectionRow('framework', ctx.framework.value, ctx.framework.confidence),
    detectionRow('orm', ctx.orm.value, ctx.orm.confidence),
    detectionRow('db', ctx.db.value, ctx.db.confidence),
    detectionRow('language', ctx.language.value, ctx.language.confidence),
    detectionRow('modules', ctx.moduleSystem.value, ctx.moduleSystem.confidence),
    detectionRow('pkg manager', ctx.packageManager, 'high'),
  ]

  // surface evidence for anything not high confidence
  const evidenceLines: string[] = []
  for (const field of [ctx.framework, ctx.orm, ctx.db, ctx.language, ctx.moduleSystem]) {
    if (field.confidence !== 'high' && field.evidence.length > 0) {
      for (const e of field.evidence) {
        evidenceLines.push(`    ${chalk.dim('↳')} ${chalk.cyan(e)}`)
      }
    }
  }

  console.log(lines.join('\n'))

  // show frontend companion if detected (full-stack setup)
  if (ctx.frontend) {
    console.log()
    console.log(
      `    ${chalk.green('✓')} ${chalk.bold('frontend')}  ${chalk.white(ctx.frontend.framework)} + ${chalk.white(ctx.frontend.buildTool)}  ${chalk.dim(`(${ctx.frontend.relPath})`)}`,
    )
  }

  if (evidenceLines.length) {
    console.log()
    for (const e of evidenceLines) console.log(e)
  }

  // flag conflicts
  if (ctx.conflicts.existingAuthDetected) {
    console.log()
    console.log(`  ${chalk.bgYellow.black(' ⚠  Conflicts Detected ')}`)
    console.log()
    for (const signal of ctx.conflicts.signals) {
      console.log(`    ${chalk.yellow('!')} ${chalk.dim(signal)}`)
    }
  }

  console.log()
}

// ============================================================
// showNoFrontendPrompt — shown when no React/Vite frontend found
// ============================================================

export async function showNoFrontendPrompt(ctx: DetectedContext): Promise<boolean> {
  // Only relevant for non-Next.js backends (Next.js has its own UI)
  if (ctx.framework.value === 'nextjs') return false

  console.log()
  console.log(`  ${chalk.bgYellow.black(' ⚠  No Frontend Detected ')}`)
  console.log()
  console.log(`    Auth UI (LoginForm, SignupForm, OAuthButton, etc.)`)
  console.log(`    requires a React or Vue companion app to render.`)
  console.log(`    Without one, only headless API scaffolding is generated.`)
  console.log()
  console.log(`    ${chalk.bold('Want to bootstrap one now?')}`)
  console.log(`    Sedim will create a React + Vite app as a sibling folder`)
  console.log(`    and wire it up to work with your ${ctx.framework.value} backend.`)
  console.log()

  const result = await clack.confirm({
    message: 'Bootstrap a React + Vite companion app?',
    initialValue: false,
  })

  if (clack.isCancel(result)) {
    return false
  }

  return result as boolean
}

// ============================================================
// Enhanced showPlanSummary — Claude CLI style with colored sections
// ============================================================

export function showPlanSummary(plan: InstallPlan): void {
  // ── header ─────────────────────────────────────────────────
  console.log()
  console.log(`  ${chalk.bgCyan.black(` Plan — ${plan.moduleName} `)}`)
  console.log()

  // ── files to create ────────────────────────────────────────
  if (plan.filesToCreate.length) {
    console.log(`  ${chalk.green('┌─ CREATE ─' + '─'.repeat(42))}`)
    for (const f of plan.filesToCreate) {
      const filename = f.path.split('/').pop() ?? f.path
      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : ''
      const line = `  ${chalk.green('+')} ${chalk.white(filename)}`
      console.log(dir ? `${line}  ${chalk.dim(dir)}` : line)
    }
    console.log(`  ${chalk.green('└' + '─'.repeat(50))}`)
  }

  // ── files to modify ────────────────────────────────────────
  if (plan.filesToModify.length) {
    console.log(`  ${chalk.yellow('┌─ MODIFY ─' + '─'.repeat(42))}`)
    for (const f of plan.filesToModify) {
      const filename = f.path.split('/').pop() ?? f.path
      console.log(`  ${chalk.yellow('~')} ${chalk.white(filename)}  ${chalk.dim(f.description)}`)
    }
    console.log(`  ${chalk.yellow('└' + '─'.repeat(50))}`)
  }

  // ── dependencies ────────────────────────────────────────────
  if (plan.dependenciesToInstall.length || plan.devDependenciesToInstall.length) {
    console.log(`  ${chalk.cyan('┌─ INSTALL ─' + '─'.repeat(40))}`)
    if (plan.dependenciesToInstall.length) {
      console.log(
        `  ${chalk.cyan('→')} ${chalk.bold('deps')}  ${chalk.cyan(plan.dependenciesToInstall.join(', '))}`,
      )
    }
    if (plan.devDependenciesToInstall.length) {
      console.log(
        `  ${chalk.cyan('→')} ${chalk.bold('devDeps')}  ${chalk.cyan(plan.devDependenciesToInstall.join(', '))}`,
      )
    }
    console.log(`  ${chalk.cyan('└' + '─'.repeat(50))}`)
  }

  // ── env vars ────────────────────────────────────────────────
  if (plan.envVarsToAdd.length) {
    console.log(`  ${chalk.magenta('┌─ ENV VARS ─' + '─'.repeat(39))}`)
    for (const e of plan.envVarsToAdd) {
      const desc = e.description.length > 48 ? e.description.slice(0, 45) + '...' : e.description
      console.log(`  ${chalk.magenta('●')} ${chalk.bold.magenta(e.key)}  ${chalk.dim(desc)}`)
    }
    console.log(`  ${chalk.magenta('└' + '─'.repeat(50))}`)
  }

  // ── conflicts ───────────────────────────────────────────────
  if (plan.conflictActions.length) {
    console.log(`  ${chalk.red('┌─ CONFLICTS ─' + '─'.repeat(38))}`)
    for (const c of plan.conflictActions) {
      console.log(`  ${chalk.red('!')} ${chalk.white(c.file)}  ${chalk.dim(c.description)}`)
    }
    console.log(`  ${chalk.red('└' + '─'.repeat(50))}`)
  }

  console.log()
}

// ============================================================
// showEndReport — post-install summary with Claude CLI style
// env vars are listed but never auto-written — user must add them
// ============================================================

export function showEndReport(plan: InstallPlan, elapsedMs: number): void {
  const elapsed = (elapsedMs / 1000).toFixed(1)

  console.log()
  console.log(`  ${chalk.bgGreen.black(' ✓  Done ')}`)
  console.log()

  const created = plan.filesToCreate.length
  const modified = plan.filesToModify.length
  const deps = plan.dependenciesToInstall.length + plan.devDependenciesToInstall.length

  if (created)
    console.log(
      `    ${chalk.green('+')} ${chalk.bold(created)} file${created !== 1 ? 's' : ''} created`,
    )
  if (modified)
    console.log(
      `    ${chalk.yellow('~')} ${chalk.bold(modified)} file${modified !== 1 ? 's' : ''} modified`,
    )
  if (deps)
    console.log(
      `    ${chalk.cyan('→')} ${chalk.bold(deps)} package${deps !== 1 ? 's' : ''} installed`,
    )

  if (plan.envVarsToAdd.length) {
    console.log()
    console.log(`  ${chalk.yellow('⚠  Add these to your .env before running:')}`)
    console.log()
    for (const e of plan.envVarsToAdd) {
      const example = e.example ? ` = ${chalk.cyan(e.example)}` : ''
      console.log(`    ${chalk.magenta('●')} ${chalk.bold.magenta(e.key)}${example}`)
    }
  }

  console.log()
  console.log(`  ${chalk.dim(`completed in ${elapsed}s`)}`)
  console.log()
}

// ============================================================
// showConflict — Claude CLI style with colored severity
// ============================================================

export function showConflict(conflict: ConflictAction): void {
  const levelColor =
    conflict.level === 'full'
      ? chalk.bgRed
      : conflict.level === 'partial'
        ? chalk.bgYellow
        : chalk.bgGreen

  console.log()
  console.log(`  ${levelColor.black(` ${conflict.level.toUpperCase()} CONFLICT `)}`)
  console.log()
  console.log(`    ${chalk.bold('file')}     ${chalk.white(conflict.file)}`)
  console.log(`    ${chalk.bold('reason')}   ${chalk.dim(conflict.description)}`)
  console.log(
    `    ${chalk.bold('resolve')}  ${chalk.yellow(conflict.resolution === 'pending-user-choice' ? 'needs decision' : conflict.resolution)}`,
  )
  console.log()
}

// ============================================================
// showDiff — per-file diff preview with colored background
// uses proper line-level diffing via the `diff` package
// Interactive paging: one file at a time, Enter for next, q to quit
// ============================================================

export async function showDiff(
  file: string,
  before: string,
  after: string,
  interactive = true,
): Promise<boolean> {
  // interactive=false returns false when user quits (for non-interactive callers)
  const changes = diffLines(before, after)

  console.log()
  console.log(`  ${chalk.bgBlue.black(` Diff: ${file} `)}`)
  console.log()

  for (const change of changes) {
    const lines = change.value.split('\n')
    if (lines[lines.length - 1] === '') lines.pop()

    if (change.added) {
      for (const line of lines) console.log(`  ${chalk.green('+')} ${chalk.green(line)}`)
    } else if (change.removed) {
      for (const line of lines) console.log(`  ${chalk.red('-')} ${chalk.red(line)}`)
    } else {
      for (const line of lines) console.log(`  ${chalk.dim(line)}`)
    }
  }

  console.log()

  if (!interactive) return true

  // ── interactive paging ─────────────────────────────────────
  const rl = await import('node:readline')
  const crlf = '\n'

  return new Promise(resolve => {
    const prompt = rl.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    prompt.question(
      `${chalk.dim('  press ')}${chalk.white('Enter')}${chalk.dim(' for next file · ')}${chalk.white('q')}${chalk.dim(' to quit → ')}`,
      (answer: string) => {
        prompt.close()
        if (answer.trim().toLowerCase() === 'q') {
          resolve(false)
        } else {
          resolve(true)
        }
      },
    )
  })
}

export async function showDiffs(
  files: Array<{ path: string; before: string; after: string }>,
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const cont = await showDiff(files[i].path, files[i].before, files[i].after, true)
    if (!cont) {
      console.log(`${chalk.dim('  (diff cancelled)')}`)
      break
    }
    // For last file, don't show "next" prompt
    if (i < files.length - 1) {
      console.log()
    }
  }
}
