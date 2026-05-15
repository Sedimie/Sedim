import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { writeFile as sedimWriteFile } from '../../src/writer/write-file'
import type { FileToCreate } from '../../src/planning/types'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'sedim-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('writeFile', () => {
  it('creates a new file with content', async () => {
    const file: FileToCreate = {
      path: 'src/lib/auth.ts',
      templateKey: 'auth/config',
      content: 'export const auth = {}',
    }

    const result = await sedimWriteFile(tmpDir, file)
    expect(result).toBe('created')

    const written = await readFile(path.join(tmpDir, 'src/lib/auth.ts'), 'utf-8')
    expect(written).toBe('export const auth = {}')
  })

  it('creates parent directories automatically', async () => {
    const file: FileToCreate = {
      path: 'src/deep/nested/file.ts',
      templateKey: 'test',
      content: 'export {}',
    }

    await sedimWriteFile(tmpDir, file)
    const written = await readFile(path.join(tmpDir, 'src/deep/nested/file.ts'), 'utf-8')
    expect(written).toBe('export {}')
  })

  it('skips existing file when strategy is skip', async () => {
    await writeFile(path.join(tmpDir, 'existing.ts'), 'original content')

    const file: FileToCreate = {
      path: 'existing.ts',
      templateKey: 'test',
      content: 'new content',
    }

    const result = await sedimWriteFile(tmpDir, file, 'skip')
    expect(result).toBe('skipped')

    // original content preserved
    const content = await readFile(path.join(tmpDir, 'existing.ts'), 'utf-8')
    expect(content).toBe('original content')
  })

  it('overwrites existing file when strategy is overwrite', async () => {
    await writeFile(path.join(tmpDir, 'existing.ts'), 'original content')

    const file: FileToCreate = {
      path: 'existing.ts',
      templateKey: 'test',
      content: 'new content',
    }

    const result = await sedimWriteFile(tmpDir, file, 'overwrite')
    expect(result).toBe('created')

    const content = await readFile(path.join(tmpDir, 'existing.ts'), 'utf-8')
    expect(content).toBe('new content')
  })

  it('throws WriteError when content is missing', async () => {
    const file: FileToCreate = {
      path: 'src/lib/auth.ts',
      templateKey: 'auth/config',
      // no content
    }

    await expect(sedimWriteFile(tmpDir, file)).rejects.toThrow('template was not rendered')
  })
})
