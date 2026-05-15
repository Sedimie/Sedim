import path from 'node:path'
import type { SessionState } from '../planning/types'
import { SEDIM_SESSION_FILE } from '../shared/constants'
import { SessionError } from '../shared/errors'
import { writeJSON } from '../shared/fs'

export async function writeSession(projectRoot: string, state: SessionState): Promise<void> {
  const sessionPath = path.join(projectRoot, SEDIM_SESSION_FILE)
  try {
    await writeJSON(sessionPath, { ...state, lastUpdatedAt: new Date().toISOString() })
  } catch (err) {
    throw new SessionError(`Could not write session file`, err)
  }
}
