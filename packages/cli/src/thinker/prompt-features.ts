import type { DetectedContext, ModuleManifest } from '../planning/types'
import * as ui from '../showbaby/index'

function formatLabel(value: string): string {
  return value
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Generic feature selection runner that builds CLI prompts dynamically
 * from the module manifest without hardcoding any module-specific identifiers.
 */
export async function promptModuleFeatures(
  manifest: ModuleManifest,
  ctx: DetectedContext,
  options: { defaultUI?: string } = {},
): Promise<string[]> {
  const selectedFeatures: string[] = []
  const featureMeta = manifest.featureMeta
  const features = manifest.features as Record<string, string[] | undefined>

  // If the manifest provides featureMeta, use the rich metadata to drive prompts
  if (featureMeta && Object.keys(featureMeta).length > 0) {
    for (const [category, meta] of Object.entries(featureMeta)) {
      const categoryOptions = features[category]
      if (!categoryOptions || categoryOptions.length === 0) continue

      let promptMsg = meta.prompt || `Which ${category}?`
      if (category === 'ui' && ctx.framework.value !== 'nextjs') {
        promptMsg += ' (requires Next.js OR a React app alongside Express/Hono)'
      }

      const choices = categoryOptions.map(optKey => {
        const optMeta = meta.options?.[optKey]
        return {
          value: optKey,
          label: optMeta?.label ?? formatLabel(optKey),
          hint: optMeta?.hint,
        }
      })

      if (meta.type === 'multiselect') {
        const picked = await ui.multiselect(promptMsg, choices)
        selectedFeatures.push(...picked)
      } else {
        // Single select
        const finalChoices = meta.allowNone
          ? [{ value: 'none', label: 'None', hint: 'skip — add it later' }, ...choices]
          : choices

        const initialVal =
          category === 'ui' && options.defaultUI && categoryOptions.includes(options.defaultUI)
            ? options.defaultUI
            : undefined

        const picked = await ui.select(promptMsg, finalChoices, initialVal)
        if (picked !== 'none') {
          selectedFeatures.push(picked)

          // Check for sub-prompts (e.g. themed UI triggering themeVariant)
          const subPromptMeta = meta.subPrompts?.[picked]
          if (subPromptMeta?.options) {
            const subChoices = Object.entries(subPromptMeta.options).map(([subKey, subOpt]) => ({
              value: subKey,
              label: subOpt.label,
              hint: subOpt.hint,
            }))
            const subPicked = await ui.select(subPromptMeta.prompt, subChoices)
            if (subPicked && subPicked !== 'none') {
              selectedFeatures.push(subPicked)
            }
          }
        }
      }
    }
    return Array.from(new Set(selectedFeatures))
  }

  // Fallback for modules without explicit featureMeta: dynamically prompt based on manifest.features
  for (const [category, values] of Object.entries(features)) {
    if (!Array.isArray(values) || values.length === 0) continue

    const promptMsg = `Select ${formatLabel(category)}:`
    const choices = values.map(v => ({
      value: v,
      label: formatLabel(v),
    }))

    const picked = await ui.multiselect(promptMsg, choices, false)
    selectedFeatures.push(...picked)
  }

  return Array.from(new Set(selectedFeatures))
}

/**
 * Generically flattens all features declared in a module manifest.
 * Used by the `plan` command to generate an exhaustive plan of all capabilities.
 */
export function getAllManifestFeatures(manifest: ModuleManifest): string[] {
  const result: string[] = []
  const features = manifest.features as Record<string, unknown>

  for (const val of Object.values(features)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') {
          result.push(item)
        }
      }
    }
  }

  if (manifest.featureMeta) {
    for (const cat of Object.values(manifest.featureMeta)) {
      if (cat.subPrompts) {
        for (const sub of Object.values(cat.subPrompts)) {
          if (sub.options) {
            result.push(...Object.keys(sub.options))
          }
        }
      }
    }
  }

  return Array.from(new Set(result))
}
