import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { SEDIM_SESSION_FILE } from '../shared/constants'
import { SessionError } from '../shared/errors'
import { exists } from '../shared/fs'

export async function clearSession(projectRoot: string): Promise<void> {
  const sessionPath = path.join(projectRoot, SEDIM_SESSION_FILE)
  if (!(await exists(sessionPath))) return
  try {
    await unlink(sessionPath)
  } catch (err) {
    throw new SessionError(`Could not clear session file`, err)
  }
}
