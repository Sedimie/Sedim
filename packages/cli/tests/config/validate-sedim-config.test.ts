import { describe, expect, it } from 'vitest'
import { validateSedimConfig } from '../../src/config/validate-sedim-config'
import { DetectionError } from '../../src/shared/errors'

describe('validateSedimConfig', () => {
  const validConfig = {
    framework: 'nextjs',
    orm: 'drizzle',
    db: 'postgres',
    language: 'typescript',
    moduleSystem: 'esm',
    sourceStructure: {
      srcDir: 'src',
      apiDir: 'src/app/api',
      routeEntrypoints: ['src/app'],
    },
    preferences: {
      ui: 'tailwind',
      confirmBeforeWrite: true,
      dryRunByDefault: false,
    },
    overrides: {},
    generatedAt: new Date().toISOString(),
  }

  it('passes for a valid configuration', () => {
    expect(() => validateSedimConfig(validConfig)).not.toThrow()
  })

  it('throws DetectionError for invalid object', () => {
    expect(() => validateSedimConfig(null)).toThrow(DetectionError)
    expect(() => validateSedimConfig('string')).toThrow(DetectionError)
  })

  it('validates framework values', () => {
    expect(() => validateSedimConfig({ ...validConfig, framework: 'ruby' })).toThrow(DetectionError)
  })

  it('validates preferences', () => {
    expect(() =>
      validateSedimConfig({
        ...validConfig,
        preferences: { ui: 'unknown-ui', confirmBeforeWrite: true, dryRunByDefault: false },
      }),
    ).toThrow(DetectionError)

    expect(() =>
      validateSedimConfig({
        ...validConfig,
        preferences: { ui: 'tailwind', confirmBeforeWrite: 'yes', dryRunByDefault: false },
      }),
    ).toThrow(DetectionError)

    expect(() =>
      validateSedimConfig({
        ...validConfig,
        preferences: { ui: 'tailwind', confirmBeforeWrite: true, dryRunByDefault: 'no' },
      }),
    ).toThrow(DetectionError)
  })

  it('validates overrides', () => {
    expect(() =>
      validateSedimConfig({
        ...validConfig,
        overrides: 'not-an-object',
      }),
    ).toThrow(DetectionError)

    expect(() =>
      validateSedimConfig({
        ...validConfig,
        overrides: { framework: 'django' },
      }),
    ).toThrow(DetectionError)

    expect(() =>
      validateSedimConfig({
        ...validConfig,
        overrides: { orm: 'typeorm' },
      }),
    ).toThrow(DetectionError)

    expect(() =>
      validateSedimConfig({
        ...validConfig,
        overrides: { db: 'cassandra' },
      }),
    ).toThrow(DetectionError)

    expect(() =>
      validateSedimConfig({
        ...validConfig,
        overrides: { structure: 'invalid' },
      }),
    ).toThrow(DetectionError)

    expect(() =>
      validateSedimConfig({
        ...validConfig,
        overrides: { codeArchitecture: 'invalid' },
      }),
    ).toThrow(DetectionError)

    expect(() =>
      validateSedimConfig({
        ...validConfig,
        overrides: {
          framework: 'hono',
          orm: 'prisma',
          db: 'mysql',
          structure: { srcDir: 'custom' },
        },
      }),
    ).not.toThrow()
  })
})
