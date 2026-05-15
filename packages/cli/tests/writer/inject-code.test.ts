import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { injectCode } from '../../src/writer/inject-code'
import type { InjectionAction } from '../../src/planning/types'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'sedim-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('injectCode', () => {
  it('injects payload after anchor', async () => {
    await writeFile(
      path.join(tmpDir, 'app.ts'),
      'const app = express()\napp.use(express.json())\n',
    )

    const action: InjectionAction = {
      file: 'app.ts',
      type: 'middleware',
      payload: 'app.use(authMiddleware)',
      anchor: 'app.use(express.json())',
      position: 'after',
      description: 'inject auth middleware',
    }

    await injectCode(tmpDir, action, false)

    const content = await readFile(path.join(tmpDir, 'app.ts'), 'utf-8')
    expect(content).toContain('app.use(express.json())\napp.use(authMiddleware)')
  })

  it('injects payload before anchor', async () => {
    await writeFile(path.join(tmpDir, 'layout.tsx'), '<body>{children}</body>')

    const action: InjectionAction = {
      file: 'layout.tsx',
      type: 'provider-wrap',
      payload: '<AuthProvider>',
      anchor: '{children}',
      position: 'before',
      description: 'wrap children with AuthProvider',
    }

    await injectCode(tmpDir, action, false)

    const content = await readFile(path.join(tmpDir, 'layout.tsx'), 'utf-8')
    expect(content).toContain('<AuthProvider>\n{children}')
  })

  it('is idempotent — skips if payload already present', async () => {
    await writeFile(
      path.join(tmpDir, 'app.ts'),
      'app.use(express.json())\napp.use(authMiddleware)\n',
    )

    const action: InjectionAction = {
      file: 'app.ts',
      type: 'middleware',
      payload: 'app.use(authMiddleware)',
      anchor: 'app.use(express.json())',
      position: 'after',
      description: 'inject auth middleware',
    }

    const result = await injectCode(tmpDir, action, false)
    expect(result).toBe('skipped')
  })

  it('throws WriteError when anchor not found', async () => {
    await writeFile(path.join(tmpDir, 'app.ts'), 'const app = express()\n')

    const action: InjectionAction = {
      file: 'app.ts',
      type: 'middleware',
      payload: 'app.use(authMiddleware)',
      anchor: 'ANCHOR_THAT_DOES_NOT_EXIST',
      position: 'after',
      description: 'inject auth middleware',
    }

    await expect(injectCode(tmpDir, action, false)).rejects.toThrow('Injection anchor not found')
  })

  it('throws WriteError when file does not exist', async () => {
    const action: InjectionAction = {
      file: 'nonexistent.ts',
      type: 'middleware',
      payload: 'something',
      anchor: 'anchor',
      position: 'after',
      description: 'test',
    }

    await expect(injectCode(tmpDir, action, false)).rejects.toThrow('does not exist')
  })
})
