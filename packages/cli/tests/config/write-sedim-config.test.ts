import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildConfig,
  buildObjectLiteral,
  writeSedimConfig,
} from '../../src/config/write-sedim-config'
import type { DetectedContext } from '../../src/planning/types'
import { SEDIM_CONFIG_CACHE, SEDIM_CONFIG_FILE } from '../../src/shared/constants'

describe('config serialization', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sedim-test-config-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  const mockCtx: DetectedContext = {
    projectRoot: '/test/app',
    packageManager: 'pnpm',
    language: { value: 'typescript', confidence: 'high', evidence: [] },
    moduleSystem: { value: 'esm', confidence: 'high', evidence: [] },
    framework: { value: 'nextjs', confidence: 'high', evidence: [] },
    orm: { value: 'drizzle', confidence: 'high', evidence: [] },
    db: { value: 'postgres', confidence: 'high', evidence: [] },
    structure: {
      srcDir: 'src',
      routeEntrypoints: ['src/app'],
      middlewareCandidates: [],
    },
    schema: {
      tables: [],
      probableUserTable: null,
      authSignals: [],
      existingAuthDetected: false,
    },
    codeArchitecture: {
      routerStyle: 'file-based',
      layoutStyle: 'app-router',
      appEntrypoint: null,
      apiDir: 'src/app/api',
      providersFile: null,
      hasBarrelExports: false,
      importStyle: 'named',
      injectionAnchors: {},
    },
    runtime: { nodeVersion: null },
    conflicts: { level: 'none', existingAuthDetected: false, signals: [] },
  }

  describe('buildConfig', () => {
    it('produces a full SedimConfig matching detected context', () => {
      const config = buildConfig(mockCtx)

      expect(config.framework).toBe('nextjs')
      expect(config.orm).toBe('drizzle')
      expect(config.db).toBe('postgres')
      expect(config.language).toBe('typescript')
      expect(config.moduleSystem).toBe('esm')
      expect(config.sourceStructure.srcDir).toBe('src')
      expect(config.sourceStructure.apiDir).toBe('src/app/api')
      expect(config.preferences.ui).toBe('headless')
      expect(config.preferences.confirmBeforeWrite).toBe(true)
      expect(config.preferences.dryRunByDefault).toBe(false)
      expect(config.generatedAt).toContain('sedim v')
    })

    it('applies overrides cleanly', () => {
      const config = buildConfig(mockCtx, {
        preferences: { ui: 'themed', confirmBeforeWrite: false, dryRunByDefault: true },
      })

      expect(config.preferences.ui).toBe('themed')
      expect(config.preferences.confirmBeforeWrite).toBe(false)
      expect(config.preferences.dryRunByDefault).toBe(true)
    })
  })

  describe('buildObjectLiteral', () => {
    it('serializes primitives correctly', () => {
      expect(buildObjectLiteral(null)).toBe('null')
      expect(buildObjectLiteral(undefined)).toBe('undefined')
      expect(buildObjectLiteral(true)).toBe('true')
      expect(buildObjectLiteral(false)).toBe('false')
      expect(buildObjectLiteral(123)).toBe('123')
      expect(buildObjectLiteral('hello')).toBe("'hello'")
    })

    it('escapes quotes and backslashes in strings', () => {
      expect(buildObjectLiteral("it's a test")).toBe("'it\\'s a test'")
      expect(buildObjectLiteral('C:\\Users\\dev\\project')).toBe("'C:\\\\Users\\\\dev\\\\project'")
    })

    it('serializes arrays with primitives', () => {
      expect(buildObjectLiteral([])).toBe('[]')
      expect(buildObjectLiteral(['a', 'b', 'c'])).toBe("['a', 'b', 'c']")
      expect(buildObjectLiteral([1, 2, 3])).toBe('[1, 2, 3]')
    })

    it('quotes object keys that are not valid JS identifiers', () => {
      const obj = {
        validKey: true,
        'dashed-key': 42,
        'with space': 'val',
      }
      const serialized = buildObjectLiteral(obj)
      expect(serialized).toContain('validKey: true')
      expect(serialized).toContain("'dashed-key': 42")
      expect(serialized).toContain("'with space': 'val'")
    })

    it('handles nested objects with proper indentation', () => {
      const nested = {
        framework: 'nextjs',
        preferences: {
          ui: 'headless',
          confirm: true,
        },
      }
      const serialized = buildObjectLiteral(nested)
      expect(serialized).toContain('framework: \'nextjs\'')
      expect(serialized).toContain('  preferences: {')
      expect(serialized).toContain('    ui: \'headless\'')
      expect(serialized).toContain('    confirm: true')
      expect(serialized).toContain('  }')
    })
  })

  describe('writeSedimConfig', () => {
    it('writes both sedim.config.ts and .sedim/config.json cache', async () => {
      const config = buildConfig(mockCtx)
      await writeSedimConfig(tmpDir, config)

      const tsContent = await fs.readFile(path.join(tmpDir, SEDIM_CONFIG_FILE), 'utf-8')
      const jsonContent = await fs.readFile(path.join(tmpDir, SEDIM_CONFIG_CACHE), 'utf-8')

      expect(tsContent).toContain('export default config')
      expect(tsContent).toContain("framework: 'nextjs'")
      expect(tsContent).toContain("orm: 'drizzle'")
      expect(tsContent).toContain("db: 'postgres'")

      const parsedJson = JSON.parse(jsonContent)
      expect(parsedJson.framework).toBe('nextjs')
      expect(parsedJson.orm).toBe('drizzle')
      expect(parsedJson.preferences.ui).toBe('headless')
    })
  })
})
