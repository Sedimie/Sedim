import type { ModuleManifest, PlanConfig, DetectedContext } from '../planning/types'

// converts a ModuleManifest (from registry) into a PlanConfig (for the thinker)
// this is a generic best-effort conversion used until a module ships
// its own plan-config.ts with framework-specific logic
//
// real modules override this by providing their own PlanConfig directly
// e.g. modules/auth/plan-config.ts returns a fully typed PlanConfig
// with proper outputPath functions and injection variants

export function manifestToPlanConfig(
  manifest: ModuleManifest,
  selectedFeatures: string[],
  _ctx: DetectedContext
): PlanConfig {
  return {
    moduleName: manifest.name,
    version: manifest.version,

    // generic templates — real modules provide proper outputPath functions
    // these are placeholders until the module ships its own plan-config
    templates: manifest.layers.delivery.stamps.map(stamp => ({
      templateKey: `${manifest.name}/${stamp}`,
      outputPath: (ctx: DetectedContext) => {
        const src = ctx.structure.srcDir ?? 'src'
        return `${src}/${manifest.name}/${stamp}.ts`
      },
      overwriteStrategy: 'ask' as const,
    })),

    // no injections from manifest alone — modules must provide these
    // in their own plan-config.ts with framework-specific variants
    injections: [],

    dependencies: manifest.requires.envVars.length > 0 ? [] : [],
    devDependencies: [],

    envVars: manifest.requires.envVars.map(key => ({
      key,
      description: `Required by ${manifest.name} module`,
      required: true,
    })),

    schemaTables: manifest.layers.persistence.tables,

    peerContracts: manifest.requires.peerModules.map(mod => ({
      module: mod,
      provides: [],
      required: true,
    })),
  }
}
