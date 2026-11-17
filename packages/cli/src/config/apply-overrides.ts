import type { DetectedContext, SedimConfig } from '../planning/types'

/**
 * Applies custom overrides from `sedim.config.ts` onto the `DetectedContext`.
 * This allows developers to manually pin or adjust framework, ORM, database,
 * language, module system, structure directories, or architecture settings.
 */
export function applyConfigOverrides(
  ctx: DetectedContext,
  config?: Partial<SedimConfig> | null,
): DetectedContext {
  if (!config || !config.overrides || typeof config.overrides !== 'object') {
    return ctx
  }

  const overrides = config.overrides as Record<string, unknown>
  const result: DetectedContext = {
    ...ctx,
    structure: { ...ctx.structure },
    codeArchitecture: { ...ctx.codeArchitecture },
  }

  if (overrides.framework && typeof overrides.framework === 'string') {
    result.framework = {
      value: overrides.framework as DetectedContext['framework']['value'],
      confidence: 'high',
      evidence: ['sedim.config.ts override'],
    }
  }

  if (overrides.orm && typeof overrides.orm === 'string') {
    result.orm = {
      value: overrides.orm as DetectedContext['orm']['value'],
      confidence: 'high',
      evidence: ['sedim.config.ts override'],
    }
  }

  if (overrides.db && typeof overrides.db === 'string') {
    result.db = {
      value: overrides.db as DetectedContext['db']['value'],
      confidence: 'high',
      evidence: ['sedim.config.ts override'],
    }
  }

  if (overrides.language && typeof overrides.language === 'string') {
    result.language = {
      value: overrides.language as DetectedContext['language']['value'],
      confidence: 'high',
      evidence: ['sedim.config.ts override'],
    }
  }

  if (overrides.moduleSystem && typeof overrides.moduleSystem === 'string') {
    result.moduleSystem = {
      value: overrides.moduleSystem as DetectedContext['moduleSystem']['value'],
      confidence: 'high',
      evidence: ['sedim.config.ts override'],
    }
  }

  if (
    overrides.structure &&
    typeof overrides.structure === 'object' &&
    overrides.structure !== null
  ) {
    result.structure = {
      ...result.structure,
      ...(overrides.structure as Record<string, unknown>),
    }
  }

  if (
    overrides.codeArchitecture &&
    typeof overrides.codeArchitecture === 'object' &&
    overrides.codeArchitecture !== null
  ) {
    result.codeArchitecture = {
      ...result.codeArchitecture,
      ...(overrides.codeArchitecture as Record<string, unknown>),
    }
  }

  return result
}
