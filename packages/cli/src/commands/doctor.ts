import path from 'node:path'
import { isSedimInitialised } from '../config/index'
import { detect } from '../detector/index'
import { bootstrapFrontendCompanion } from '../frontend/bootstrap'
import { readSession } from '../session/index'
import { MIN_NODE_VERSION } from '../shared/constants'
import { ensureProjectRoot } from '../shared/ensure-project'
import { exists } from '../shared/fs'
import type { DoctorCheck } from '../showbaby/index'
import * as ui from '../showbaby/index'

export async function runDoctor(): Promise<void> {
  ui.showIntro('doctor')

  const projectRoot = await ensureProjectRoot()
  const checks: DoctorCheck[] = []

  // ── node version ─────────────────────────────────────────
  const nodeMajor = parseInt(process.version.slice(1))
  checks.push({
    name: 'Node version',
    status: nodeMajor >= MIN_NODE_VERSION ? 'pass' : 'fail',
    message: `${process.version} (>=${MIN_NODE_VERSION} required)`,
    fix: nodeMajor < MIN_NODE_VERSION ? `Install Node.js ${MIN_NODE_VERSION}+` : undefined,
  })

  // ── sedim initialised ────────────────────────────────────
  const initialised = await isSedimInitialised(projectRoot)
  checks.push({
    name: 'sedim.config.ts',
    status: initialised ? 'pass' : 'warn',
    message: initialised ? 'found at project root' : 'not found',
    fix: initialised ? undefined : 'Run `sedim init`',
  })

  // ── active session ───────────────────────────────────────
  const session = await readSession(projectRoot)
  checks.push({
    name: 'Active session',
    status: session ? 'warn' : 'pass',
    message: session
      ? `interrupted session for "${session.moduleName}" (${session.status})`
      : 'none',
    fix: session ? `Run \`sedim continue ${session.moduleName}\`` : undefined,
  })

  // ── detection ────────────────────────────────────────────
  ui.logSection('Running detector...')
  const spinner = ui.spinDetecting()

  let ctx: Awaited<ReturnType<typeof detect>> | null = null

  try {
    ctx = await detect(projectRoot)
    spinner.stop('Detection complete')

    checks.push({
      name: 'Framework',
      status: ctx.framework.value === 'unknown' ? 'warn' : 'pass',
      message: `${ctx.framework.value} (${ctx.framework.confidence} confidence)`,
      fix:
        ctx.framework.value === 'unknown' ? 'Set framework manually in sedim.config.ts' : undefined,
    })

    checks.push({
      name: 'ORM',
      status: ctx.orm.value === 'unknown' ? 'warn' : 'pass',
      message: `${ctx.orm.value} (${ctx.orm.confidence} confidence)`,
    })

    checks.push({
      name: 'Database',
      status: ctx.db.value === 'unknown' ? 'warn' : 'pass',
      message: `${ctx.db.value} (${ctx.db.confidence} confidence)`,
    })

    // ── env vars ───────────────────────────────────────────
    const envExists =
      (await exists(path.join(projectRoot, '.env'))) ||
      (await exists(path.join(projectRoot, '.env.local')))
    checks.push({
      name: '.env file',
      status: envExists ? 'pass' : 'warn',
      message: envExists ? 'found' : 'no .env or .env.local found',
      fix: envExists ? undefined : 'Create a .env file at your project root',
    })

    // ── no frontend? offer to bootstrap one ─────────────────
    if (!ctx.frontend && ctx.framework.value !== 'nextjs') {
      const shouldBootstrap = await ui.showNoFrontendPrompt(ctx)
      if (shouldBootstrap) {
        const result = await bootstrapFrontendCompanion(projectRoot)
        if (result) {
          ui.logSuccess(`Frontend ready at ${result.dir}/`)
        }
      }
    }
  } catch (err) {
    spinner.stop('Detection failed')
    checks.push({
      name: 'Detection',
      status: 'fail',
      message: String(err),
      fix: 'Check that you are running sedim from inside your project directory',
    })
  }

  ui.showDoctorReport(checks)

  const failed = checks.filter(c => c.status === 'fail').length
  const warned = checks.filter(c => c.status === 'warn').length

  if (failed > 0) {
    ui.showOutro(
      `${failed} issue${failed !== 1 ? 's' : ''} found — fix them before running sedim add.`,
    )
  } else if (warned > 0) {
    ui.showOutro(`${warned} warning${warned !== 1 ? 's' : ''} — things will work but review them.`)
  } else {
    ui.showOutro('Everything looks good.')
  }
}
