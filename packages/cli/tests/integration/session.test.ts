import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { readSession, writeSession, clearSession } from '../../src/session/index'
import type { SessionState, InstallPlan } from '../../src/planning/types'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'sedim-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

const mockPlan: InstallPlan = {
  moduleName: 'auth',
  selectedFeatures: ['email-password'],
  dependenciesToInstall: ['better-auth'],
  devDependenciesToInstall: [],
  envVarsToAdd: [{ key: 'AUTH_SECRET', description: 'signing secret' }],
  filesToCreate: [{ path: 'src/lib/auth.ts', templateKey: 'auth/config' }],
  filesToModify: [],
  migrationsToCreate: [],
  injectionActions: [],
  conflictActions: [],
  rollbackHints: ['delete src/lib/auth.ts'],
}

const mockSession: SessionState = {
  moduleName: 'auth',
  startedAt: '2025-01-01T00:00:00.000Z',
  lastUpdatedAt: '2025-01-01T00:00:00.000Z',
  currentStep: 'writer:start',
  completedSteps: ['detector', 'thinker'],
  selectedOptions: { providers: ['email-password'] },
  planSnapshot: mockPlan,
  status: 'active',
}

describe('session round-trip', () => {
  it('returns null when no session exists', async () => {
    const result = await readSession(tmpDir)
    expect(result).toBeNull()
  })

  it('writes and reads back a session correctly', async () => {
    await writeSession(tmpDir, mockSession)
    const result = await readSession(tmpDir)

    expect(result).not.toBeNull()
    expect(result!.moduleName).toBe('auth')
    expect(result!.status).toBe('active')
    expect(result!.planSnapshot.moduleName).toBe('auth')
    expect(result!.completedSteps).toEqual(['detector', 'thinker'])
  })

  it('updates lastUpdatedAt on write', async () => {
    await writeSession(tmpDir, mockSession)
    const result = await readSession(tmpDir)

    // lastUpdatedAt should be updated to now, not the original value
    expect(result!.lastUpdatedAt).not.toBe(mockSession.lastUpdatedAt)
  })

  it('clears session file', async () => {
    await writeSession(tmpDir, mockSession)
    await clearSession(tmpDir)

    const result = await readSession(tmpDir)
    expect(result).toBeNull()
  })

  it('clearSession does not throw when no session exists', async () => {
    await expect(clearSession(tmpDir)).resolves.not.toThrow()
  })
})
