import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { patchFile, backupFile } from '../../src/writer/patch-file'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'sedim-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('backupFile', () => {
  it('creates a .sedim.bak file with original content', async () => {
    await writeFile(path.join(tmpDir, 'app.ts'), 'original content')

    const backupPath = await backupFile(tmpDir, 'app.ts')

    expect(backupPath).toContain('.sedim.bak')
    const backup = await readFile(backupPath, 'utf-8')
    expect(backup).toBe('original content')
  })
})

describe('patchFile', () => {
  it('replaces find with replace in file', async () => {
    await writeFile(
      path.join(tmpDir, 'app.ts'),
      "import express from 'express'\nconst app = express()\n",
    )

    await patchFile(tmpDir, 'app.ts', "const app = express()", "const app = express()\napp.use(cors())", false)

    const content = await readFile(path.join(tmpDir, 'app.ts'), 'utf-8')
    expect(content).toContain('app.use(cors())')
  })

  it('creates backup by default', async () => {
    await writeFile(path.join(tmpDir, 'app.ts'), 'const x = 1')

    await patchFile(tmpDir, 'app.ts', 'const x = 1', 'const x = 2')

    const backupExists = await readFile(path.join(tmpDir, 'app.ts.sedim.bak'), 'utf-8')
    expect(backupExists).toBe('const x = 1')
  })

  it('throws WriteError when file does not exist', async () => {
    await expect(patchFile(tmpDir, 'missing.ts', 'find', 'replace', false)).rejects.toThrow(
      'does not exist',
    )
  })

  it('throws WriteError when anchor text not found in file', async () => {
    await writeFile(path.join(tmpDir, 'app.ts'), 'const x = 1')

    await expect(
      patchFile(tmpDir, 'app.ts', 'ANCHOR_NOT_IN_FILE', 'replacement', false),
    ).rejects.toThrow('Patch anchor not found')
  })
})
