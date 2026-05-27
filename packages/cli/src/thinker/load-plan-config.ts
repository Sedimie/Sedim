import { createWriteStream } from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'
import type { DetectedContext, ModuleManifest, PlanConfig } from '../planning/types'
import { DEFAULT_PACKAGES_URL } from '../shared/constants'
import { manifestToPlanConfig } from './manifest-to-plan-config.js'

const streamPipeline = promisify(pipeline)

// Downloads a remote .js file to a temp location so Node's ESM loader can import it.
// Node's native ESM loader only supports file:// and data:// URLs — not https://.
// By downloading to /tmp/ we get a path that import() can handle.
async function downloadToTemp(url: string, suffix: string): Promise<string> {
  const tmpDir = os.tmpdir()
  const tmpPath = `${tmpDir}/sedim-${suffix}-${Date.now()}.js`
  await new Promise<void>((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const file = createWriteStream(tmpPath)
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    })
    req.on('error', reject)
  })
  return tmpPath
}

// Attempts to load a module's own plan-config.ts for richer, framework-aware planning.
// Falls back to the generic manifestToPlanConfig if no module-specific config exists.
//
// Load order:
//   1. Workspace package import  — works when running CLI from monorepo dev
//   2. Remote .js from GitHub   — works when CLI is installed globally
//   3. Generic manifest fallback — works with only a remote manifest
//
// Module plan-configs live at packages/<module>/src/plan-config.ts
// They export a createXxxPlanConfig(ctx, selectedFeatures) function.
// The remote equivalent is at packages/<module>/planConfig/plan-config.js (compiled via tsup).

export async function loadPlanConfig(
  moduleName: string,
  manifest: ModuleManifest,
  ctx: DetectedContext,
  selectedFeatures: string[],
  packagesUrl = DEFAULT_PACKAGES_URL,
): Promise<PlanConfig> {
  // 1. try workspace package import — monorepo dev mode
  try {
    const fnName = `create${capitalize(moduleName)}PlanConfig`
    const mod = await import(`@sedim/${moduleName}/plan-config`)
    if (mod && typeof mod[fnName] === 'function') {
      return (mod[fnName] as (ctx: DetectedContext, features: string[]) => PlanConfig)(
        ctx,
        selectedFeatures,
      )
    }
  } catch {
    // fall through
  }

  // 2. try remote .js from GitHub — global/installed CLI mode
  // Node's native ESM loader can't import https:// URLs, so we download to /tmp first
  try {
    const fnName = `create${capitalize(moduleName)}PlanConfig`
    const remoteUrl = `${packagesUrl}/${moduleName}/planConfig/plan-config.js`
    const tmpPath = await downloadToTemp(remoteUrl, moduleName)
    const mod = await import(tmpPath)
    if (mod && typeof mod[fnName] === 'function') {
      return (mod[fnName] as (ctx: DetectedContext, features: string[]) => PlanConfig)(
        ctx,
        selectedFeatures,
      )
    }
  } catch {
    // fall through
  }

  // 3. generic fallback — works with only a remote manifest
  return manifestToPlanConfig(manifest, selectedFeatures, ctx)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
