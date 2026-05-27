import type { DetectedContext, ModuleManifest, PlanConfig } from '../planning/types'
import { DEFAULT_PACKAGES_URL } from '../shared/constants'
import { manifestToPlanConfig } from './manifest-to-plan-config.js'

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
// The remote equivalent is at packages/<module>/dist/plan-config.js (compiled via tsup).

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
  try {
    const fnName = `create${capitalize(moduleName)}PlanConfig`
    const remoteUrl = `${packagesUrl}/${moduleName}/planConfig/plan-config.js`
    const mod = await import(remoteUrl)
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
