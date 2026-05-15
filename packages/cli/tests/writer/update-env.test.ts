import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { updateEnv } from '../../src/writer/update-env'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'sedim-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('updateEnv', () => {
  it('creates .env if it does not exist', async () => {
    await updateEnv(tmpDir, [
      { key: 'AUTH_SECRET', description: 'signing secret', example: 'openssl rand -hex 32' },
    ])

    const content = await readFile(path.join(tmpDir, '.env'), 'utf-8')
    expect(content).toContain('AUTH_SECRET=')
    expect(content).toContain('# signing secret')
    expect(content).toContain('# Added by sedim')
  })

  it('appends to existing .env without overwriting existing keys', async () => {
    await writeFile(
      path.join(tmpDir, '.env'),
      'DATABASE_URL=postgres://localhost/mydb\nEXISTING_KEY=value\n',
    )

    await updateEnv(tmpDir, [
      { key: 'AUTH_SECRET', description: 'signing secret' },
      { key: 'DATABASE_URL', description: 'already set' }, // should be skipped
    ])

    const content = await readFile(path.join(tmpDir, '.env'), 'utf-8')
    expect(content).toContain('DATABASE_URL=postgres://localhost/mydb') // original preserved
    expect(content).toContain('AUTH_SECRET=') // new key added
    // DATABASE_URL should not appear twice
    expect(content.split('DATABASE_URL=').length - 1).toBe(1)
  })

  it('does nothing when all keys already exist', async () => {
    await writeFile(path.join(tmpDir, '.env'), 'AUTH_SECRET=existing\n')

    await updateEnv(tmpDir, [{ key: 'AUTH_SECRET', description: 'signing secret' }])

    const content = await readFile(path.join(tmpDir, '.env'), 'utf-8')
    expect(content).toBe('AUTH_SECRET=existing\n') // unchanged
  })

  it('does nothing when envVars array is empty', async () => {
    await updateEnv(tmpDir, [])
    // no .env file should be created
    await expect(readFile(path.join(tmpDir, '.env'), 'utf-8')).rejects.toThrow()
  })
})
