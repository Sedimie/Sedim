import { createWriteStream } from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import type { DetectedContext, ModuleManifest, PlanConfig } from '../planning/types'
import { DEFAULT_PACKAGES_URL } from '../shared/constants'
import { RegistryError } from '../shared/errors.js'
import { manifestToPlanConfig } from './manifest-to-plan-config.js'

// Downloads a remote .js file to a temp location so Node's ESM loader can import it.
// Node's native ESM loader only supports file:// and data:// URLs — not https://.
// By downloading to /tmp/ we get a path that import() can handle.
// Returns null if the file does not exist (404), or throws RegistryError on transport/rate-limit/server errors.
export async function downloadToTemp(url: string, suffix: string): Promise<string | null> {
  const tmpDir = os.tmpdir()
  const tmpPath = `${tmpDir}/sedim-${suffix}-${Date.now()}.js`
  return new Promise<string | null>((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, res => {
      if (res.statusCode === 404) {
        resolve(null)
        return
      }
      if (res.statusCode === 429) {
        reject(
          new RegistryError(
            `GitHub rate limit exceeded while downloading plan-config from ${url}`,
            undefined,
            'GitHub API rate limit reached. Wait a few moments or set a local registry in sedim.config.ts.',
          ),
        )
        return
      }
      if (res.statusCode && res.statusCode >= 500) {
        reject(
          new RegistryError(
            `GitHub server error (HTTP ${res.statusCode}) while downloading plan-config from ${url}`,
            undefined,
            'GitHub is experiencing server errors. Try again in a few minutes.',
          ),
        )
        return
      }
      if (res.statusCode !== 200) {
        reject(
          new RegistryError(
            `Failed to download plan-config (HTTP ${res.statusCode}) from ${url}`,
            undefined,
            'Check your network connection or verify that the registry URL is correct.',
          ),
        )
        return
      }
      const file = createWriteStream(tmpPath)
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve(tmpPath)))
      file.on('error', err => reject(err))
    })

    req.on('timeout', () => {
      req.destroy()
      reject(
        new RegistryError(
          `Request timed out after 15s while downloading plan-config from ${url}`,
          undefined,
          'Check your internet connection or verify that the registry URL is reachable.',
        ),
      )
    })

    req.on('error', err => {
      reject(
        new RegistryError(
          `Network error while downloading plan-config from ${url}: ${err.message}`,
          err,
          'Check your internet connection and verify that GitHub is reachable.',
        ),
      )
    })
  })
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
  const fnName = `create${capitalize(moduleName)}PlanConfig`
  const remoteUrl = `${packagesUrl}/${moduleName}/planConfig/plan-config.js`
  const tmpPath = await downloadToTemp(remoteUrl, moduleName)
  if (tmpPath) {
    try {
      const mod = await import(tmpPath)
      if (mod && typeof mod[fnName] === 'function') {
        return (mod[fnName] as (ctx: DetectedContext, features: string[]) => PlanConfig)(
          ctx,
          selectedFeatures,
        )
      }
    } catch {
      // module could not be evaluated, fall through to generic manifest fallback
    }
  }

  // 3. generic fallback — works with only a remote manifest
  return manifestToPlanConfig(manifest, selectedFeatures, ctx)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
