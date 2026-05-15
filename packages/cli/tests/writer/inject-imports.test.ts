import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { injectImport } from '../../src/writer/inject-imports'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'sedim-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('injectImport', () => {
  it('adds import after last existing import', async () => {
    await writeFile(
      path.join(tmpDir, 'app.ts'),
      "import express from 'express'\nimport cors from 'cors'\n\nconst app = express()\n",
    )

    await injectImport(tmpDir, 'app.ts', "import { auth } from './lib/auth'")

    const content = await readFile(path.join(tmpDir, 'app.ts'), 'utf-8')
    // new import should appear after the existing imports
    const importIdx = content.indexOf("import { auth } from './lib/auth'")
    const corsIdx = content.indexOf("import cors from 'cors'")
    expect(importIdx).toBeGreaterThan(corsIdx)
  })

  it('prepends import when no existing imports', async () => {
    await writeFile(path.join(tmpDir, 'app.ts'), 'const app = express()\n')

    await injectImport(tmpDir, 'app.ts', "import express from 'express'")

    const content = await readFile(path.join(tmpDir, 'app.ts'), 'utf-8')
    expect(content.startsWith("import express from 'express'")).toBe(true)
  })

  it('is idempotent — skips if same module already imported', async () => {
    await writeFile(
      path.join(tmpDir, 'app.ts'),
      "import { auth } from './lib/auth'\nconst app = express()\n",
    )

    const result = await injectImport(
      tmpDir,
      'app.ts',
      "import { auth, signIn } from './lib/auth'",
    )
    expect(result).toBe('skipped')

    // file should be unchanged
    const content = await readFile(path.join(tmpDir, 'app.ts'), 'utf-8')
    expect(content).not.toContain('signIn')
  })

  it('throws WriteError when file does not exist', async () => {
    await expect(
      injectImport(tmpDir, 'nonexistent.ts', "import { auth } from './lib/auth'"),
    ).rejects.toThrow('does not exist')
  })
})
