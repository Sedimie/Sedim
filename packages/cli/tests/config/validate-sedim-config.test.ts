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
      ui: 'headless',
      confirmBeforeWrite: true,
      dryRunByDefault: false,
    },
    overrides: {},
    generatedAt: '2026-11-16T00:00:00.000Z — sedim v1.0.0',
  }

  it('passes on a valid config object', () => {
    expect(() => validateSedimConfig(validConfig)).not.toThrow()
  })

  it('throws DetectionError if config is null or non-object', () => {
    expect(() => validateSedimConfig(null)).toThrow(DetectionError)
    expect(() => validateSedimConfig('string')).toThrow(DetectionError)
    expect(() => validateSedimConfig(123)).toThrow(DetectionError)
  })

  it('throws DetectionError for invalid framework', () => {
    expect(() => validateSedimConfig({ ...validConfig, framework: 'invalid-fw' })).toThrow(
      /Invalid framework/,
    )
  })

  it('throws DetectionError for invalid orm', () => {
    expect(() => validateSedimConfig({ ...validConfig, orm: 'invalid-orm' })).toThrow(
      /Invalid orm/,
    )
  })

  it('throws DetectionError for invalid db', () => {
    expect(() => validateSedimConfig({ ...validConfig, db: 'oracle' })).toThrow(
      /Invalid db/,
    )
  })

  it('throws DetectionError for invalid language', () => {
    expect(() => validateSedimConfig({ ...validConfig, language: 'rust' })).toThrow(
      /Invalid language/,
    )
  })

  it('throws DetectionError for invalid moduleSystem', () => {
    expect(() => validateSedimConfig({ ...validConfig, moduleSystem: 'amd' })).toThrow(
      /Invalid moduleSystem/,
    )
  })

  it('throws DetectionError for missing or invalid preferences', () => {
    expect(() => validateSedimConfig({ ...validConfig, preferences: null })).toThrow(
      /missing preferences/,
    )
    expect(() =>
      validateSedimConfig({
        ...validConfig,
        preferences: { ...validConfig.preferences, ui: 'bootstrap' },
      }),
    ).toThrow(/Invalid ui preference/)
    expect(() =>
      validateSedimConfig({
        ...validConfig,
        preferences: { ...validConfig.preferences, confirmBeforeWrite: 'yes' },
      }),
    ).toThrow(/confirmBeforeWrite must be a boolean/)
    expect(() =>
      validateSedimConfig({
        ...validConfig,
        preferences: { ...validConfig.preferences, dryRunByDefault: 'no' },
      }),
    ).toThrow(/dryRunByDefault must be a boolean/)
  })

  it('throws DetectionError for invalid overrides type', () => {
    expect(() => validateSedimConfig({ ...validConfig, overrides: 'not-an-object' })).toThrow(
      /overrides must be an object/,
    )
  })
})
