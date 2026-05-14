import path from 'node:path'
import { writeJSON, exists, readJSON } from '../shared/fs'
import { SEDIM_DIR } from '../shared/constants'

interface AuditEntry {
  timestamp: string
  command: string
  module?: string
  filesCreated?: string[]
  filesModified?: string[]
  status: 'success' | 'failed' | 'cancelled'
  error?: string
}

// appends an entry to .sedim/audit.json
// this is what sedim doctor reads to show history
export async function writeAuditEntry(
  projectRoot: string,
  entry: Omit<AuditEntry, 'timestamp'>
): Promise<void> {
  try {
    const auditPath = path.join(projectRoot, SEDIM_DIR, 'audit.json')
    const existing = (await exists(auditPath))
      ? await readJSON<AuditEntry[]>(auditPath)
      : []

    existing.push({ ...entry, timestamp: new Date().toISOString() })

    // keep last 50 entries
    const trimmed = existing.slice(-50)
    await writeJSON(auditPath, trimmed)
  } catch {
    // intentionally silent
  }
}
