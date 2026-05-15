import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { exists, readText, writeText, readJSON, writeJSON, findProjectRoot } from '../../src/shared/fs'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'sedim-fs-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('exists', () => {
  it('returns true for existing file', async () => {
    await writeFile(path.join(tmpDir, 'test.txt'), 'hello')
    expect(await exists(path.join(tmpDir, 'test.txt'))).toBe(true)
  })

  it('returns false for missing file', async () => {
    expect(await exists(path.join(tmpDir, 'missing.txt'))).toBe(false)
  })
})

describe('readText / writeText', () => {
  it('round-trips text content', async () => {
    await writeText(path.join(tmpDir, 'file.txt'), 'hello world')
    const result = await readText(path.join(tmpDir, 'file.txt'))
    expect(result).toBe('hello world')
  })

  it('writeText creates parent directories automatically', async () => {
    await writeText(path.join(tmpDir, 'deep/nested/file.txt'), 'content')
    const result = await readText(path.join(tmpDir, 'deep/nested/file.txt'))
    expect(result).toBe('content')
  })

  it('readText throws WriteError for missing file', async () => {
    await expect(readText(path.join(tmpDir, 'missing.txt'))).rejects.toThrow('Could not read file')
  })
})

describe('readJSON / writeJSON', () => {
  it('round-trips JSON content', async () => {
    const data = { name: 'test', value: 42, nested: { ok: true } }
    await writeJSON(path.join(tmpDir, 'data.json'), data)
    const result = await readJSON<typeof data>(path.join(tmpDir, 'data.json'))
    expect(result).toEqual(data)
  })

  it('writeJSON formats with 2-space indentation', async () => {
    await writeJSON(path.join(tmpDir, 'data.json'), { key: 'value' })
    const raw = await readText(path.join(tmpDir, 'data.json'))
    expect(raw).toContain('  "key"') // 2-space indent
  })

  it('readJSON throws WriteError for missing file', async () => {
    await expect(readJSON(path.join(tmpDir, 'missing.json'))).rejects.toThrow()
  })
})

describe('findProjectRoot', () => {
  it('finds root from package.json', async () => {
    await writeFile(path.join(tmpDir, 'package.json'), '{"name":"test"}')
    const result = await findProjectRoot(tmpDir)
    expect(result).toBe(tmpDir)
  })

  it('prefers sedim.config.ts over package.json', async () => {
    // create a subdirectory with package.json
    const subDir = path.join(tmpDir, 'subdir')
    await mkdir(subDir)
    await writeFile(path.join(tmpDir, 'package.json'), '{"name":"root"}')
    await writeFile(path.join(subDir, 'package.json'), '{"name":"sub"}')
    // put sedim.config.ts in subdir
    await writeFile(path.join(subDir, 'sedim.config.ts'), 'export default {}')

    const result = await findProjectRoot(subDir)
    expect(result).toBe(subDir)
  })

  it('walks up from subdirectory to find package.json', async () => {
    await writeFile(path.join(tmpDir, 'package.json'), '{"name":"test"}')
    const subDir = path.join(tmpDir, 'src', 'components')
    await mkdir(subDir, { recursive: true })

    const result = await findProjectRoot(subDir)
    expect(result).toBe(tmpDir)
  })

  it('skips workspace roots and keeps walking', async () => {
    // workspace root has pnpm-workspace.yaml
    await writeFile(path.join(tmpDir, 'package.json'), '{"name":"workspace"}')
    await writeFile(path.join(tmpDir, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"')

    // app inside workspace has its own package.json
    const appDir = path.join(tmpDir, 'apps', 'myapp')
    await mkdir(appDir, { recursive: true })
    await writeFile(path.join(appDir, 'package.json'), '{"name":"myapp"}')

    const result = await findProjectRoot(appDir)
    expect(result).toBe(appDir)
  })

  it('throws DetectionError when no project root found', async () => {
    // empty tmpDir with no package.json — will walk up to filesystem root
    // use a path that definitely has no package.json above it
    await expect(findProjectRoot('/tmp/definitely-no-package-json-here-xyz')).rejects.toThrow(
      'Could not find project root',
    )
  })
})
