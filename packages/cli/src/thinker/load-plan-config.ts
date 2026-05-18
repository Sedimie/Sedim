import type { DetectedContext, ModuleManifest, PlanConfig } from '../planning/types'
import { manifestToPlanConfig } from './manifest-to-plan-config.js'

// Attempts to load a module's own plan-config.ts for richer, framework-aware planning.
// Falls back to the generic manifestToPlanConfig if no module-specific config exists.
//
// Module plan-configs live at packages/<module>/src/plan-config.ts
// They export a createXxxPlanConfig(ctx, selectedFeatures) function.
// This is how auth (and future modules) override the generic thinker behaviour.

export async function loadPlanConfig(
  moduleName: string,
  manifest: ModuleManifest,
  ctx: DetectedContext,
  selectedFeatures: string[],
): Promise<PlanConfig> {
  // try to dynamically import the module's own plan-config
  // this works in the monorepo because packages are workspace dependencies
  try {
    const moduleId = `@sedim/${moduleName}`
    const mod = await import(moduleId).catch(() => null)

    // look for createXxxPlanConfig — e.g. createAuthPlanConfig
    const fnName = `create${capitalize(moduleName)}PlanConfig`
    if (mod && typeof mod[fnName] === 'function') {
      return (mod[fnName] as (ctx: DetectedContext, features: string[]) => PlanConfig)(
        ctx,
        selectedFeatures,
      )
    }

    // also try the /plan-config subpath export
    const subMod = await import(`${moduleId}/plan-config`).catch(() => null)
    if (subMod && typeof subMod[fnName] === 'function') {
      return (subMod[fnName] as (ctx: DetectedContext, features: string[]) => PlanConfig)(
        ctx,
        selectedFeatures,
      )
    }
  } catch {
    // module not installed or no plan-config — fall through to generic
  }

  // generic fallback — works for any module with a valid manifest
  return manifestToPlanConfig(manifest, selectedFeatures, ctx)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
