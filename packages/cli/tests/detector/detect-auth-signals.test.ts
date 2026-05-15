import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectAuthSignals } from '../../src/detector/detect-auth-signals'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

describe('detectAuthSignals', () => {
  it('detects existing auth from next-auth dep and auth file', async () => {
    const result = await detectAuthSignals(fix('nextjs-existing-auth'))
    expect(result.existingAuthDetected).toBe(true)
    expect(result.authSignals.some(s => s.includes('next-auth'))).toBe(true)
    expect(result.authSignals.some(s => s.includes('src/lib/auth.ts'))).toBe(true)
  })

  it('detects auth column signals from schema', async () => {
    const result = await detectAuthSignals(fix('nextjs-existing-auth'))
    expect(result.authSignals.some(s => s.includes('password_hash'))).toBe(true)
    expect(result.authSignals.some(s => s.includes('session_token'))).toBe(true)
  })

  it('detects probable user table from schema', async () => {
    const result = await detectAuthSignals(fix('nextjs-existing-auth'))
    expect(result.probableUserTable).toBe('users')
    expect(result.tables).toContain('users')
    expect(result.tables).toContain('sessions')
  })

  it('returns no auth signals for clean project', async () => {
    const result = await detectAuthSignals(fix('nextjs-drizzle-ts'))
    expect(result.existingAuthDetected).toBe(false)
    expect(result.authSignals).toHaveLength(0)
  })

  it('returns empty signals for empty directory', async () => {
    const result = await detectAuthSignals(fix('empty'))
    expect(result.existingAuthDetected).toBe(false)
    expect(result.tables).toHaveLength(0)
  })
})
