// demo runner — shows the full showbaby UX flow
// run with: pnpm --filter @sedim/cli exec tsx src/showbaby/demo.ts

import * as ui from './index'
import { detect } from '../detector/index'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const playgroundPath = path.resolve(__dirname, '../../../../apps/playground')

async function main() {
  // ── intro ────────────────────────────────────────────────
  ui.showIntro('init')

  // ── detection ────────────────────────────────────────────
  ui.logSection('Detection')
  const spinner = ui.spinDetecting()

  const ctx = await detect(playgroundPath)
  spinner.stop('Stack detected')

  ui.showDetectionSummary(ctx)

  // ── prompts ───────────────────────────────────────────────
  ui.logSection('Configuration')

  const proceed = await ui.confirm('Looks good — proceed with init?')
  if (!proceed) ui.showCancel()

  const ui_level = await ui.select('UI style for components?', [
    { value: 'headless', label: 'Headless', hint: 'unstyled, full control' },
    { value: 'tailwind', label: 'Tailwind', hint: 'pre-styled with tailwind' },
    { value: 'themed',   label: 'Themed',   hint: 'pre-built theme variants' },
  ])

  const features = await ui.multiselect('Which auth providers?', [
    { value: 'email-password', label: 'Email + Password' },
    { value: 'magic-link',     label: 'Magic Link' },
    { value: 'oauth-google',   label: 'Google OAuth' },
    { value: 'oauth-github',   label: 'GitHub OAuth' },
  ])

  // ── tasks ─────────────────────────────────────────────────
  ui.logSection('Writing')

  await ui.runTasks([
    {
      title: 'Writing sedim.config.ts',
      task: async () => {
        await new Promise(r => setTimeout(r, 600))
      },
    },
    {
      title: 'Creating .sedim directory',
      task: async () => {
        await new Promise(r => setTimeout(r, 400))
      },
    },
  ])

  // ── plan summary ──────────────────────────────────────────
  ui.logSection('Plan Preview')

  const mockPlan = {
    moduleName: 'auth',
    selectedFeatures: features,
    dependenciesToInstall: ['better-auth'],
    devDependenciesToInstall: [],
    envVarsToAdd: [
      { key: 'AUTH_SECRET',    description: 'random secret for signing sessions', example: 'openssl rand -hex 32' },
      { key: 'DATABASE_URL',   description: 'postgres connection string' },
    ],
    filesToCreate: [
      { path: 'src/lib/auth.ts',              templateKey: 'auth-config' },
      { path: 'src/app/api/auth/[...all]/route.ts', templateKey: 'auth-route' },
      { path: 'src/db/schema/auth.ts',        templateKey: 'auth-schema' },
    ],
    filesToModify: [
      { path: 'src/app/layout.tsx', operation: 'inject' as const, description: 'wrap with SessionProvider' },
    ],
    migrationsToCreate: ['0001_add_auth_tables'],
    injectionActions: [],
    conflictActions: [],
    rollbackHints: ['delete src/lib/auth.ts', 'revert src/app/layout.tsx'],
  }

  ui.showPlanSummary(mockPlan)

  const applyPlan = await ui.confirm('Apply this plan?')
  if (!applyPlan) {
    ui.logWarn('Plan not applied. Run `sedim init` again to restart.')
    ui.showCancel('Exited without changes.')
  }

  // ── end report ────────────────────────────────────────────
  ui.showEndReport(mockPlan, 2340)

  // ── error demo ────────────────────────────────────────────
  ui.logSection('Error Display Demo')
  ui.showError(new Error('Could not write src/lib/auth.ts — permission denied'))

  // ── doctor demo ───────────────────────────────────────────
  ui.logSection('Doctor Report Demo')
  ui.showDoctorReport([
    { name: 'Node version',   status: 'pass', message: 'v22.18.0 (>=18 required)' },
    { name: 'sedim.config.ts',status: 'pass', message: 'found at project root' },
    { name: 'DATABASE_URL',   status: 'warn', message: 'not set in .env', fix: 'add DATABASE_URL to your .env file' },
    { name: 'AUTH_SECRET',    status: 'fail', message: 'missing — auth will not work', fix: 'run: openssl rand -hex 32' },
  ])

  ui.showOutro(`Done. Selected: ${ui_level} UI, providers: ${features.join(', ')}`)
}

main().catch(err => {
  ui.showError(err)
  process.exit(1)
})
