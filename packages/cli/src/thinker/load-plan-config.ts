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
  // try workspace package import first — this is how tsx resolves TypeScript correctly
  // the @sedim/auth symlink in node_modules links to packages/auth/src/
  try {
    const fnName = `create${capitalize(moduleName)}PlanConfig`
    const mod = await import(`@sedim/${moduleName}/plan-config`)
    if (mod && typeof mod[fnName] === 'function') {
      return (mod[fnName] as (ctx: DetectedContext, features: string[]) => PlanConfig)(
        ctx,
        selectedFeatures,
      )
    }
  } catch (err) {
    // module not installed, no plan-config, or import failed — fall through to generic
    // swallow all errors silently — generic fallback is always available
  }

  // generic fallback — works for any module with a valid manifest
  return manifestToPlanConfig(manifest, selectedFeatures, ctx)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
