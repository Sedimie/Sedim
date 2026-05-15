import path from 'node:path'
import type { SessionState } from '../planning/types'
import { SEDIM_SESSION_FILE } from '../shared/constants'
import { SessionError } from '../shared/errors'
import { exists, readJSON } from '../shared/fs'

export async function readSession(projectRoot: string): Promise<SessionState | null> {
  const sessionPath = path.join(projectRoot, SEDIM_SESSION_FILE)
  if (!(await exists(sessionPath))) return null

  try {
    return await readJSON<SessionState>(sessionPath)
  } catch (err) {
    throw new SessionError(`Could not read session file at ${sessionPath}`, err)
  }
}
