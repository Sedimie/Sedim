import type { DetectedContext, SedimConfig } from '../planning/types'
import { DetectionError } from '../shared/errors'

const VALID_FRAMEWORKS = ['nextjs', 'express', 'hono', 'fastify', 'unknown']
const VALID_ORMS = ['drizzle', 'prisma', 'none', 'unknown']
const VALID_DBS = ['postgres', 'mysql', 'sqlite', 'mongodb', 'unknown']
const VALID_LANGUAGES = ['typescript', 'javascript']
const VALID_MODULE_SYSTEMS = ['esm', 'cjs', 'unknown']
const VALID_UI_LEVELS = ['headless', 'tailwind', 'themed']

export function validateSedimConfig(config: unknown): asserts config is SedimConfig {
  if (!config || typeof config !== 'object') {
    throw new DetectionError(
      'sedim.config.ts is invalid — expected an object',
      undefined,
      'Run `sedim init` to regenerate the config.',
    )
  }

  const c = config as Record<string, unknown>

  // Core detection fields
  if (!VALID_FRAMEWORKS.includes(c.framework as string)) {
    throw new DetectionError(`Invalid framework "${c.framework}" in sedim.config.ts`)
  }
  if (!VALID_ORMS.includes(c.orm as string)) {
    throw new DetectionError(`Invalid orm "${c.orm}" in sedim.config.ts`)
  }
  if (!VALID_DBS.includes(c.db as string)) {
    throw new DetectionError(`Invalid db "${c.db}" in sedim.config.ts`)
  }
  if (!VALID_LANGUAGES.includes(c.language as string)) {
    throw new DetectionError(`Invalid language "${c.language}" in sedim.config.ts`)
  }
  if (!VALID_MODULE_SYSTEMS.includes(c.moduleSystem as string)) {
    throw new DetectionError(`Invalid moduleSystem "${c.moduleSystem}" in sedim.config.ts`)
  }

  // Preferences
  const prefs = c.preferences
  if (!prefs || typeof prefs !== 'object') {
    throw new DetectionError('sedim.config.ts is missing preferences', undefined)
  }
  const p = prefs as Record<string, unknown>
  if (typeof p.ui !== 'string' || !VALID_UI_LEVELS.includes(p.ui)) {
    throw new DetectionError(
      `Invalid ui preference "${p.ui}" — must be headless, tailwind, or themed`,
    )
  }
  if (typeof p.confirmBeforeWrite !== 'boolean') {
    throw new DetectionError('preferences.confirmBeforeWrite must be a boolean')
  }
  if (typeof p.dryRunByDefault !== 'boolean') {
    throw new DetectionError('preferences.dryRunByDefault must be a boolean')
  }

  // Source structure
  const ss = c.sourceStructure
  if (!ss || typeof ss !== 'object') {
    throw new DetectionError('sedim.config.ts is missing sourceStructure', undefined)
  }

  // Overrides validation
  if (c.overrides !== undefined) {
    if (typeof c.overrides !== 'object' || c.overrides === null || Array.isArray(c.overrides)) {
      throw new DetectionError('overrides must be an object')
    }
    const o = c.overrides as Record<string, unknown>
    if (o.framework !== undefined && !VALID_FRAMEWORKS.includes(o.framework as string)) {
      throw new DetectionError(`Invalid framework override "${o.framework}" in sedim.config.ts`)
    }
    if (o.orm !== undefined && !VALID_ORMS.includes(o.orm as string)) {
      throw new DetectionError(`Invalid orm override "${o.orm}" in sedim.config.ts`)
    }
    if (o.db !== undefined && !VALID_DBS.includes(o.db as string)) {
      throw new DetectionError(`Invalid db override "${o.db}" in sedim.config.ts`)
    }
    if (o.language !== undefined && !VALID_LANGUAGES.includes(o.language as string)) {
      throw new DetectionError(`Invalid language override "${o.language}" in sedim.config.ts`)
    }
    if (o.moduleSystem !== undefined && !VALID_MODULE_SYSTEMS.includes(o.moduleSystem as string)) {
      throw new DetectionError(
        `Invalid moduleSystem override "${o.moduleSystem}" in sedim.config.ts`,
      )
    }
    if (
      o.structure !== undefined &&
      (typeof o.structure !== 'object' || o.structure === null || Array.isArray(o.structure))
    ) {
      throw new DetectionError('overrides.structure must be an object')
    }
    if (
      o.codeArchitecture !== undefined &&
      (typeof o.codeArchitecture !== 'object' ||
        o.codeArchitecture === null ||
        Array.isArray(o.codeArchitecture))
    ) {
      throw new DetectionError('overrides.codeArchitecture must be an object')
    }
  }
}
