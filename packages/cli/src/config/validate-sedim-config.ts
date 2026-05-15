import type { SedimConfig } from '../planning/types'
import { DetectionError } from '../shared/errors'

const VALID_FRAMEWORKS = ['nextjs', 'express', 'hono', 'fastify', 'unknown']
const VALID_ORMS = ['drizzle', 'prisma', 'none', 'unknown']
const VALID_DBS = ['postgres', 'mysql', 'sqlite', 'mongodb', 'unknown']
const VALID_LANGUAGES = ['typescript', 'javascript']
const VALID_MODULE_SYSTEMS = ['esm', 'cjs', 'unknown']

export function validateSedimConfig(config: unknown): asserts config is SedimConfig {
  if (!config || typeof config !== 'object') {
    throw new DetectionError(
      'sedim.config.ts is invalid — expected an object',
      undefined,
      'Run `sedim init` to regenerate the config.',
    )
  }

  const c = config as Record<string, unknown>

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
}
