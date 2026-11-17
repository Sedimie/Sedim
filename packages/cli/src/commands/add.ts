import { isSedimInitialised, readSedimConfig } from '../config/index'
import { detect } from '../detector/index'
import { verifyAndOverrideDetection } from '../detector/override'
import { bootstrapFrontendCompanion } from '../frontend/bootstrap'
import type { DetectedContext, InstallPlan, ModuleManifest } from '../planning/types'
import { readSession, writeSession } from '../session/index'
import { ensureProjectRoot } from '../shared/ensure-project'
import * as ui from '../showbaby/index'
import { writeAuditEntry } from '../telemetry/audit-log'
import { logger } from '../telemetry/logger'
import { buildPlan, promptModuleFeatures } from '../thinker/index'
import { loadModuleManifest } from '../thinker/load-module-manifest'
import { loadPlanConfig } from '../thinker/load-plan-config'
import { applyPlan } from '../writer/index'
import { runContinue } from './continue'

export async function runAdd(
  moduleName: string,
  options: { dryRun?: boolean; force?: boolean } = {},
): Promise<void> {
  ui.showBanner(`add ${moduleName}`)
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

  // ── no frontend? offer to bootstrap one ──────────────────────
  // This runs before feature selection so the frontend exists when
  // the plan is built (plan-config stamps UI into the frontend).
  if (!ctx.frontend) {
    const shouldBootstrap = await ui.showNoFrontendPrompt(ctx)
    if (shouldBootstrap) {
      const result = await bootstrapFrontendCompanion(projectRoot)
      if (result) {
        ctx.frontend = result.frontend
      }
    }
  }

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

  const selectedFeatures = await promptModuleFeatures(manifest, ctx)

  // ── build plan ───────────────────────────────────────────
  ui.logSection('Planning')
  const planSpinner = ui.createSpinner('Building install plan...')

  // load plan config — uses module's own plan-config.ts if available,
  // falls back to generic manifest conversion
  const planConfig = await loadPlanConfig(moduleName, manifest, ctx, selectedFeatures)

  // Fail fast for unsupported stacks — don't build a plan we can't use
  const unsupported = (planConfig as unknown as Record<string, unknown>)['_unsupportedReasons'] as
    | string[]
    | undefined
  if (unsupported?.length) {
    planSpinner.stop('Unsupported stack')
    for (const reason of unsupported) {
      ui.logError(reason)
    }
    ui.showCancel(
      'Cannot proceed — use a supported stack (Next.js, Express, or Hono with Drizzle or Prisma).',
    )
  }

  let plan: InstallPlan
  try {
    plan = await buildPlan(ctx, planConfig, selectedFeatures)
    planSpinner.stop('Plan ready')
  } catch (err) {
    planSpinner.stop('Planning failed')
    ui.showError(err)
    process.exit(1)
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
    // Show the OAuth setup guide when user declines so they know how to get credentials
    const oauthProviders = selectedFeatures.filter(p => p.startsWith('oauth-'))
    const oauthEnvVars = plan.envVarsToAdd.filter(
      e =>
        e.key.startsWith('GOOGLE_') || e.key.startsWith('GITHUB_') || e.key.startsWith('DISCORD_'),
    )
    if (oauthProviders.length > 0 || oauthEnvVars.length > 0) {
      const { showOAuthSetupGuide, showQuickEnvSummary } = await import(
        '../showbaby/oauth-guide.js'
      )
      showOAuthSetupGuide(oauthProviders)
      showQuickEnvSummary(plan.envVarsToAdd)
    }
    ui.showCancel(`No files written — run \`sedim add ${moduleName}\` again when ready.`)
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
