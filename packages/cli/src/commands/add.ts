import { isSedimInitialised, readSedimConfig } from '../config/index'
import { detect } from '../detector/index'
import { verifyAndOverrideDetection } from '../detector/override'
import type { DetectedContext, InstallPlan, ModuleManifest } from '../planning/types'
import { readSession, writeSession } from '../session/index'
import { ensureProjectRoot } from '../shared/ensure-project'
import * as ui from '../showbaby/index'
import { writeAuditEntry } from '../telemetry/audit-log'
import { logger } from '../telemetry/logger'
import { buildPlan } from '../thinker/index'
import { loadModuleManifest } from '../thinker/load-module-manifest'
import { loadPlanConfig } from '../thinker/load-plan-config'
import { applyPlan } from '../writer/index'
import { runContinue } from './continue'

export async function runAdd(
  moduleName: string,
  options: { dryRun?: boolean; force?: boolean } = {},
): Promise<void> {
  ui.showIntro(`add ${moduleName}`)
  const start = Date.now()

  const projectRoot = await ensureProjectRoot()
  await logger.info(projectRoot, `add ${moduleName} started`, options)

  // ── must be initialised ──────────────────────────────────
  if (!(await isSedimInitialised(projectRoot))) {
    ui.showError(new Error('Project not initialised. Run `sedim init` first.'))
    process.exit(1)
  }

  // ── check for existing session ───────────────────────────
  const existingSession = await readSession(projectRoot)
  if (existingSession?.moduleName === moduleName && existingSession.status === 'active') {
    const resume = await ui.confirm(
      `Found an interrupted session for "${moduleName}". Resume it?`,
      true,
    )
    if (resume) {
      ui.logInfo('Resuming session automatically...')
      return runContinue(moduleName)
    }
    // user chose not to resume — clear the stale session and start fresh
    const { clearSession } = await import('../session/index.js')
    await clearSession(projectRoot)
  }

  // ── detection ────────────────────────────────────────────
  ui.logSection('Detection')
  const spinner = ui.spinDetecting()

  let ctx: DetectedContext
  try {
    ctx = await detect(projectRoot)
    spinner.stop('Stack detected')
  } catch (err) {
    spinner.stop('Detection failed')
    ui.showError(err)
    process.exit(1)
  }

  ui.showDetectionSummary(ctx)
  ctx = await verifyAndOverrideDetection(ctx)

  // ── load manifest ────────────────────────────────────────
  ui.logSection('Module')
  const manifestSpinner = ui.createSpinner(`Fetching ${moduleName} manifest...`)

  let manifest: ModuleManifest
  try {
    manifest = await loadModuleManifest(moduleName)
    manifestSpinner.stop(`${moduleName} manifest loaded`)
  } catch (err) {
    manifestSpinner.stop('Failed to load manifest')
    ui.showError(err)
    process.exit(1)
  }

  // ── feature selection ────────────────────────────────────
  ui.logSection('Configuration')

  const selections: Record<string, unknown> = {}

  if (manifest.features.providers?.length) {
    const providerLabels: Record<string, { label: string; hint: string }> = {
      'email-password': { label: 'Email + Password', hint: 'classic credential auth' },
      'magic-link': { label: 'Magic Link', hint: 'passwordless email login' },
      'oauth-google': { label: 'Google OAuth', hint: 'sign in with Google' },
      'oauth-github': { label: 'GitHub OAuth', hint: 'sign in with GitHub' },
      'oauth-discord': { label: 'Discord OAuth', hint: 'sign in with Discord' },
      totp: { label: 'TOTP (2FA)', hint: 'Google Authenticator, Authy' },
    }
    selections.providers = await ui.multiselect(
      'Which auth providers?',
      manifest.features.providers.map(p => ({
        value: p,
        label: providerLabels[p]?.label ?? p,
        hint: providerLabels[p]?.hint,
      })),
    )
  }

  if (manifest.features.ui?.length) {
    const uiLabels: Record<string, { label: string; hint: string }> = {
      headless: { label: 'Headless', hint: 'unstyled, full control' },
      tailwind: { label: 'Tailwind', hint: 'pre-styled with Tailwind CSS' },
      themed: { label: 'Themed', hint: 'pre-built theme variants' },
    }
    selections.ui = await ui.select(
      'UI style for auth components?',
      manifest.features.ui.map(u => ({
        value: u,
        label: uiLabels[u]?.label ?? u,
        hint: uiLabels[u]?.hint,
      })),
    )

    if (selections.ui === 'themed') {
      selections.themeVariant = await ui.select('Which theme variant?', [
        { value: 'modern', label: 'Modern', hint: 'Glassmorphism & Gradients' },
        { value: 'minimal', label: 'Minimal', hint: 'Neumorphism & Soft UI' },
        { value: 'colorful', label: 'Colorful', hint: 'Neubrutalism' },
      ])
    }
  }

  if (manifest.features.authorization?.length) {
    selections.authorization = await ui.select(
      'Authorization model?',
      manifest.features.authorization.map(a => ({ value: a, label: a })),
    )
  }

  // ── build plan ───────────────────────────────────────────
  ui.logSection('Planning')
  const planSpinner = ui.createSpinner('Building install plan...')

  // selectedFeatures is the flat list of what the user picked
  const selectedFeatures = [
    ...((selections.providers as string[]) ?? []),
    ...((selections.ui as string[]) ? [selections.ui as string] : []),
    ...((selections.themeVariant as string[]) ? [selections.themeVariant as string] : []),
    ...((selections.authorization as string[]) ? [selections.authorization as string] : []),
  ]

  // load plan config — uses module's own plan-config.ts if available,
  // falls back to generic manifest conversion
  const planConfig = await loadPlanConfig(moduleName, manifest, ctx, selectedFeatures)

  let plan: InstallPlan
  try {
    plan = await buildPlan(ctx, planConfig, selectedFeatures)
    planSpinner.stop('Plan ready')
  } catch (err) {
    planSpinner.stop('Planning failed')
    ui.showError(err)
    process.exit(1)
  }

  // surface unsupported stack warnings before showing the plan
  const unsupported = (planConfig as unknown as Record<string, unknown>)['_unsupportedReasons'] as
    | string[]
    | undefined
  if (unsupported?.length) {
    for (const reason of unsupported) {
      ui.logWarn(reason)
    }
    ui.showCancel('Cannot proceed — resolve the issues above first.')
  }

  ui.showPlanSummary(plan)

  if (options.dryRun) {
    ui.logNote('Dry run — no files written.', 'Dry Run')
    ui.showOutro('Dry run complete.')
    return
  }

  // ── resolve pending conflicts before writing ─────────────
  // any conflict still marked pending-user-choice must be resolved
  // before the writer runs — writer only executes, never decides
  const pendingConflicts = plan.conflictActions.filter(c => c.resolution === 'pending-user-choice')

  if (pendingConflicts.length > 0 && !options.force) {
    ui.logSection('Conflicts')

    for (const conflict of pendingConflicts) {
      ui.showConflict(conflict)

      if (conflict.level === 'full') {
        ui.logWarn('Full conflict detected — cannot proceed without --force.')
        ui.showCancel('Cancelled — no files written.')
      }

      const resolution = await ui.select<'skip' | 'overwrite'>(
        `How to handle "${conflict.file}"?`,
        [
          { value: 'skip', label: 'Skip', hint: 'leave the existing file untouched' },
          { value: 'overwrite', label: 'Overwrite', hint: 'replace with the new version' },
        ],
      )
      conflict.resolution = resolution
    }
  }

  // ── confirm before write ─────────────────────────────────
  const proceed = await ui.confirm('Apply this plan?', true)
  if (!proceed) {
    ui.showCancel('Cancelled — no files written.')
    process.exit(0)
  }

  // ── collect env var values interactively ─────────────────
  // only prompt for vars that aren't already set in .env
  let collectedEnvValues = new Map<string, string>()
  if (plan.envVarsToAdd.length > 0) {
    ui.logSection('Environment Variables')
    // build full config with required/default metadata from planConfig
    const envVarMeta = new Map((planConfig.envVars ?? []).map(v => [v.key, v]))
    const envVarsWithMeta = plan.envVarsToAdd.map(v => ({
      ...v,
      required: envVarMeta.get(v.key)?.required ?? true,
      default: envVarMeta.get(v.key)?.default,
    }))
    collectedEnvValues = await ui.collectEnvValues(envVarsWithMeta)
  }

  // ── save session before writing ──────────────────────────
  await writeSession(projectRoot, {
    moduleName,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    currentStep: 'writer:start',
    completedSteps: ['detector', 'thinker'],
    selectedOptions: selections,
    planSnapshot: plan,
    status: 'active',
  })

  // ── apply plan ───────────────────────────────────────────
  ui.logSection('Writing')

  try {
    await ui.runTasks([
      {
        title: 'Installing dependencies',
        enabled: plan.dependenciesToInstall.length > 0 || plan.devDependenciesToInstall.length > 0,
        task: async () => {
          const { installDependencies } = await import('../shared/package-manager.js')
          if (plan.dependenciesToInstall.length > 0) {
            await installDependencies(plan.dependenciesToInstall, projectRoot, false)
          }
          if (plan.devDependenciesToInstall.length > 0) {
            await installDependencies(plan.devDependenciesToInstall, projectRoot, true)
          }
          return `${plan.dependenciesToInstall.length + plan.devDependenciesToInstall.length} packages installed`
        },
      },
      {
        title: `Stamping ${plan.filesToCreate.length} file${plan.filesToCreate.length !== 1 ? 's' : ''}`,
        task: async () => {
          const { writeFile } = await import('../writer/write-file.js')
          for (const file of plan.filesToCreate) {
            const conflictAction = plan.conflictActions.find(c => c.file === file.path)
            const strategy = conflictAction?.resolution === 'skip' ? 'skip' : 'overwrite'
            await writeFile(projectRoot, file, strategy)
          }
          return `${plan.filesToCreate.length} files written`
        },
      },
      {
        title: 'Injecting wiring',
        enabled: plan.injectionActions.length > 0,
        task: async () => {
          const { injectImport } = await import('../writer/inject-imports.js')
          const { injectCode } = await import('../writer/inject-code.js')
          const imports = plan.injectionActions.filter(a => a.type === 'import')
          const code = plan.injectionActions.filter(a => a.type !== 'import')
          for (const action of imports) await injectImport(projectRoot, action.file, action.payload)
          for (const action of code) await injectCode(projectRoot, action)
          return `${plan.injectionActions.length} injection${plan.injectionActions.length !== 1 ? 's' : ''} applied`
        },
      },
      {
        title: 'Updating .env',
        enabled: plan.envVarsToAdd.length > 0,
        task: async () => {
          const { updateEnv } = await import('../writer/update-env.js')
          await updateEnv(projectRoot, plan.envVarsToAdd, collectedEnvValues)
          return `${plan.envVarsToAdd.length} env var${plan.envVarsToAdd.length !== 1 ? 's' : ''} added`
        },
      },
    ])
  } catch (err) {
    ui.showError(err)
    await writeAuditEntry(projectRoot, {
      command: 'add',
      module: moduleName,
      status: 'failed',
      error: String(err),
    })
    ui.logWarn('Session preserved — run `sedim continue` to retry.')
    process.exit(1)
  }

  await writeAuditEntry(projectRoot, {
    command: 'add',
    module: moduleName,
    filesCreated: plan.filesToCreate.map(f => f.path),
    filesModified: plan.filesToModify.map(f => f.path),
    status: 'success',
  })

  // Clear session properly upon success so it doesn't prompt resume next time
  const { clearSession } = await import('../session/index.js')
  await clearSession(projectRoot)

  ui.showEndReport(plan, Date.now() - start)
  ui.showOutro(`${moduleName} installed.`)
}
