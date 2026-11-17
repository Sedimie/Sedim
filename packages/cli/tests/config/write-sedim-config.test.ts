import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildConfig, buildObjectLiteral, writeSedimConfig } from '../../src/config/write-sedim-config'
import type { DetectedContext, SedimConfig } from '../../src/planning/types'

describe('writeSedimConfig & buildObjectLiteral (fixes #3)', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sedim-config-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  function makeDetectedContext(): DetectedContext {
    return {
      framework: { value: 'nextjs', confidence: 1, signals: [] },
      orm: { value: 'drizzle', confidence: 1, signals: [] },
      db: { value: 'pg', confidence: 1, signals: [] },
      language: { value: 'typescript', confidence: 1, signals: [] },
      moduleSystem: { value: 'esm', confidence: 1, signals: [] },
      structure: { srcDir: 'src', apiDir: 'src/app/api', routeEntrypoints: [] },
      codeArchitecture: {
        pattern: 'app-router',
        apiDir: 'src/app/api',
        componentsDir: 'src/components',
        appEntrypoint: null,
      },
      hasSrcDir: true,
      hasTailwind: true,
      existingAuth: null,
      frontend: null,
    }
  }

  it('buildObjectLiteral formats primitives and escapes backslashes properly', () => {
    expect(buildObjectLiteral(null)).toBe('null')
    expect(buildObjectLiteral(undefined)).toBe('undefined')
    expect(buildObjectLiteral(true)).toBe('true')
    expect(buildObjectLiteral(42)).toBe('42')
    expect(buildObjectLiteral('hello world')).toBe("'hello world'")
    expect(buildObjectLiteral("it's working")).toBe("'it\\'s working'")
    expect(buildObjectLiteral('C:\\Users\\admin\\repo')).toBe("'C:\\\\Users\\\\admin\\\\repo'")
  })

  it('buildObjectLiteral formats arrays and objects with nested indentation', () => {
    expect(buildObjectLiteral([])).toBe('[]')
    expect(buildObjectLiteral({})).toBe('{}')
    expect(buildObjectLiteral(['a', 'b'])).toBe("['a', 'b']")

    const obj = {
      nested: {
        flag: true,
        count: 1,
      },
      'hyphenated-key': 'value',
    }
    const output = buildObjectLiteral(obj)
    expect(output).toContain("  'hyphenated-key': 'value'")
    expect(output).toContain('  nested: {')
    expect(output).toContain('    flag: true')
    expect(output).toContain('    count: 1')
  })

  it('writes sedim.config.ts with inlined SedimConfig interface without external @sedim/cli import', async () => {
    const ctx = makeDetectedContext()
    const config = buildConfig(ctx)

    await writeSedimConfig(tmpDir, config)

    const configContent = await fs.readFile(path.join(tmpDir, 'sedim.config.ts'), 'utf8')
    const cacheContent = await fs.readFile(path.join(tmpDir, '.sedim', 'config.json'), 'utf8')

    // Must NOT import from @sedim/cli so globally installed CLI configs typecheck in zero-dep projects
    expect(configContent).not.toContain("import type { SedimConfig } from '@sedim/cli'")
    expect(configContent).not.toContain('@sedim/cli')

    // Must declare the inlined SedimConfig interface
    expect(configContent).toContain('export interface SedimConfig {')
    expect(configContent).toContain("framework: 'nextjs' | 'express' | 'hono'")
    expect(configContent).toContain("orm: 'drizzle' | 'prisma' | 'none'")
    expect(configContent).toContain("db: 'pg' | 'mysql' | 'sqlite' | 'none'")
    expect(configContent).toContain("language: 'typescript' | 'javascript'")
    expect(configContent).toContain("moduleSystem: 'esm' | 'cjs'")
    expect(configContent).toContain('preferences: {')
    expect(configContent).toContain('overrides: Record<string, unknown>')
    expect(configContent).toContain('const config: SedimConfig = {')
    expect(configContent).toContain('export default config')

    // Cache json should match config
    const parsedCache = JSON.parse(cacheContent)
    expect(parsedCache.framework).toBe('nextjs')
    expect(parsedCache.orm).toBe('drizzle')
  })
})
