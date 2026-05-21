import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DetectedFrontend } from '@sedim/core'
import chalk from 'chalk'
import { execa } from 'execa'
import fs from 'fs-extra'
import * as ui from '../showbaby/index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Frontend companion bootstrap ─────────────────────────────────
// Bootstraps a React+Vite companion app as a sibling to the backend.
// Used when `sedim add auth` runs on Express/Hono without a frontend detected.

// Common directory names to offer as choices
const COMMON_FRONTEND_DIRS = [
  { value: 'client', label: 'client/', hint: 'sibling to server/backend' },
  { value: 'frontend', label: 'frontend/' },
  { value: 'web', label: 'web/' },
  { value: 'app', label: 'app/' },
  { value: 'apps/web', label: 'apps/web/', hint: 'monorepo workspace' },
]

/**
 * Bootstraps a React+Vite companion app alongside the user's backend.
 * Called when `sedim add auth` detects no frontend companion.
 *
 * Flow:
 *   1. Ask where to create the app
 *   2. Scaffold Vite+React in that directory
 *   3. Run `sedim init` in the new directory
 *   4. Return DetectedFrontend so the caller can update ctx.frontend
 */
export async function bootstrapFrontendCompanion(
  projectRoot: string,
  opts: { dir?: string; force?: boolean } = {},
): Promise<{ frontend: DetectedFrontend; dir: string } | null> {
  // ── pick directory ─────────────────────────────────────────
  const dir = opts.dir ?? (await pickFrontendDir(projectRoot))
  if (!dir) return null

  const absDir = path.resolve(projectRoot, dir)

  // ── scaffold Vite + React ───────────────────────────────────
  ui.logSection('Bootstrapping frontend')
  const spinner = ui.createSpinner('Scaffolding React + Vite...')

  try {
    // Ensure parent dir exists
    await fs.ensureDir(absDir)

    // Check if directory already has content
    if (opts.force) {
      // --force: clear the directory first so vite scaffolds cleanly
      await fs.emptyDir(absDir)
    } else {
      const entries = await fs.readdir(absDir)
      if (entries.length > 0) {
        spinner.stop('Directory not empty')
        ui.logWarn(`${dir}/ already exists and is not empty. Use --force to override.`)
        return null
      }
    }

    // Scaffold using Vite's create command
    // `npm create vite@latest . -- --template react-ts` scaffolds in current dir
    await execa('npm', ['create', 'vite@latest', '.', '--', '--template', 'react-ts'], {
      cwd: absDir,
      stdout: 'pipe',
      stderr: 'pipe',
      timeoutMs: 120_000,
    })

    spinner.stop('React + Vite scaffolded')
  } catch (err) {
    spinner.stop('Scaffold failed')
    ui.showError(err as Error)
    return null
  }

  // ── run sedim init in the new frontend ───────────────────────
  const initSpinner = ui.createSpinner('Running sedim init in frontend...')

  // Find the sedim CLI entry point relative to this file
  // packages/cli/src/frontend/bootstrap.ts → packages/cli/src/index.ts
  const cliEntry = path.resolve(__dirname, '../index.ts')

  try {
    // Run sedim init --force in the frontend directory
    await execa('node', [cliEntry, 'init', '--force'], {
      cwd: absDir,
      stdout: 'pipe',
      stderr: 'pipe',
      timeoutMs: 60_000,
    })
    initSpinner.stop('Frontend initialised')
  } catch (err) {
    initSpinner.stop('sedim init skipped')
    const msg = err instanceof Error ? err.message : String(err)
    ui.logWarn(
      `Could not run sedim init in ${dir}/ — init it manually: ${chalk.cyan('sedim init')}`,
    )
  }

  // ── detect the frontend to confirm it worked ─────────────────
  const detectSpinner = ui.createSpinner('Detecting frontend...')

  try {
    const { detectFrontend } = await import('../detector/detect-frontend.js')
    const detected = await detectFrontend(absDir)

    if (!detected) {
      detectSpinner.stop('Detection failed')
      ui.logWarn(
        'Frontend scaffolded but detection failed. Run `sedim init` manually in the frontend folder.',
      )
      return null
    }

    detectSpinner.stop('Frontend detected')
    console.log(`  ${chalk.green('✓')} Frontend ready at ${chalk.bold(dir)}/`)

    return {
      frontend: detected,
      dir,
    }
  } catch (err) {
    detectSpinner.stop('Detection failed')
    ui.showError(err as Error)
    return null
  }
}

// ── Directory picker ──────────────────────────────────────────────

async function pickFrontendDir(projectRoot: string): Promise<string | null> {
  // Check which common dirs already exist so we can skip them
  const withExists = await Promise.all(
    COMMON_FRONTEND_DIRS.map(async d => ({
      ...d,
      exists: await fs.pathExists(path.resolve(projectRoot, d.value)),
    })),
  )

  const available = withExists.filter(d => !d.exists)
  const dirOptions = (
    available.length > 0
      ? available
      : [...COMMON_FRONTEND_DIRS, { value: 'custom', label: 'custom path...', hint: undefined }]
  ).map(d => ({ value: d.value, label: d.label, hint: d.hint }))

  const selected: string = await ui.select(
    'No frontend detected. Where should we create the React companion?',
    dirOptions as { value: string; label: string; hint?: string }[],
  )

  if (selected === 'custom') {
    const customDir = await ui.text('Enter directory name', 'client')
    if (!customDir || customDir.trim() === '') return null
    return customDir.trim()
  }

  return selected
}
