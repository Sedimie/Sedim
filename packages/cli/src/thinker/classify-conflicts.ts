import path from 'node:path'
import type { ConflictAction, ConflictLevel, DetectedContext } from '../planning/types'
import { exists } from '../shared/fs'

export interface ConflictResult {
  level: ConflictLevel
  actions: ConflictAction[]
}

// classifies conflicts between what the module wants to do
// and what already exists in the project
export async function classifyConflicts(
  projectRoot: string,
  ctx: DetectedContext,
  filesToCreate: string[],
  schemaTables: string[],
): Promise<ConflictResult> {
  const actions: ConflictAction[] = []

  // files the module wants to create that already exist
  for (const file of filesToCreate) {
    if (await exists(path.join(projectRoot, file))) {
      actions.push({
        file,
        level: 'partial',
        description: 'File already exists and would be overwritten',
        resolution: 'pending-user-choice',
      })
    }
  }

  // schema tables the module wants to create that already exist
  const existingTables = ctx.schema.tables.map(t => t.toLowerCase())
  for (const table of schemaTables) {
    if (existingTables.includes(table.toLowerCase())) {
      actions.push({
        file: `schema (table: ${table})`,
        level: 'partial',
        description: `Table "${table}" already exists in schema`,
        resolution: 'pending-user-choice',
      })
    }
  }

  // existing auth detected = always at least partial conflict for auth modules
  if (ctx.conflicts.existingAuthDetected) {
    for (const signal of ctx.conflicts.signals) {
      actions.push({
        file: 'existing auth',
        level: 'partial',
        description: signal,
        resolution: 'pending-user-choice',
      })
    }
  }

  // level classification:
  // full  = existing auth + files to modify (high risk of breaking things)
  // partial = some files exist or schema conflicts
  // none  = clean slate
  const hasFullConflict = ctx.conflicts.existingAuthDetected && actions.length > 1
  const level: ConflictLevel = hasFullConflict ? 'full' : actions.length > 0 ? 'partial' : 'none'

  return { level, actions }
}
