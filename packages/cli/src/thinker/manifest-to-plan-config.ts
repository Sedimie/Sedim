import type { DetectedContext, ModuleManifest, PlanConfig } from '../planning/types'

export function manifestToPlanConfig(
  manifest: ModuleManifest,
  selectedFeatures: string[],
  _ctx: DetectedContext,
): PlanConfig {
  // filter env vars to only those relevant to selected features
  // if envVarMeta exists, use it for descriptions and filtering
  // otherwise fall back to requiring all declared env vars
  const envVars = manifest.requires.envVars
    .filter(key => {
      const meta = manifest.envVarMeta?.[key]
      if (!meta) return true // no metadata — always include
      if (meta.required) return true // always required regardless of features
      if (!meta.requiredFor || meta.requiredFor.length === 0) return true
      // include if any selected feature needs this var
      return meta.requiredFor.some(f => selectedFeatures.includes(f))
    })
    .map(key => {
      const meta = manifest.envVarMeta?.[key]
      return {
        key,
        description: meta?.description ?? `Required by ${manifest.name} module`,
        example: meta?.example,
        required: meta?.required ?? true,
      }
    })

  return {
    moduleName: manifest.name,
    version: manifest.version,

    templates: manifest.layers.delivery.stamps.map(stamp => ({
      templateKey: `${manifest.name}/${stamp}`,
      outputPath: (ctx: DetectedContext) => {
        const src = ctx.structure.srcDir ?? 'src'
        return `${src}/${manifest.name}/${stamp}.ts`
      },
      overwriteStrategy: 'ask' as const,
    })),

    injections: [],

    dependencies: [],
    devDependencies: [],

    envVars,

    schemaTables: manifest.layers.persistence.tables,

    peerContracts: manifest.requires.peerModules.map(mod => ({
      module: mod,
      provides: [],
      required: true,
    })),
  }
}
