import path from 'node:path'
import type { UserTableAnalysis } from '../detector/detect-auth-signals'
import type { ConflictAction, ConflictLevel, DetectedContext } from '../planning/types'
import { exists } from '../shared/fs'

export interface ConflictResult {
  level: ConflictLevel
  actions: ConflictAction[]
  /** Populated when a users table was found — used by plan-config to decide schema strategy */
  userTableAnalysis?: UserTableAnalysis
}

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

  // schema table conflicts
  const existingTables = ctx.schema.tables.map(t => t.toLowerCase())
  const analysis = (ctx.schema as unknown as { userTableAnalysis?: UserTableAnalysis })
    .userTableAnalysis

  for (const table of schemaTables) {
    if (!existingTables.includes(table.toLowerCase())) continue

    const isUserTable = table.toLowerCase() === 'users' || table.toLowerCase() === 'user'

    if (isUserTable && analysis) {
      if (analysis.status === 'compatible') {
      } else if (analysis.status === 'needs-migration') {
        actions.push({
          file: `schema (table: ${table})`,
          level: 'partial',
          description: `Table "${table}" exists but is missing columns: ${analysis.missingColumns.join(', ')}. sedim will generate ALTER TABLE migrations to add them.`,
          resolution: 'pending-user-choice',
        })
      } else if (analysis.status === 'incompatible') {
        actions.push({
          file: `schema (table: ${table})`,
          level: 'full',
          description: `Table "${table}" is incompatible: ${analysis.incompatibleReason ?? 'structural mismatch'}. Align your schema manually then re-run sedim add auth.`,
          resolution: 'pending-user-choice',
        })
      }
    } else {
      actions.push({
        file: `schema (table: ${table})`,
        level: 'partial',
        description: `Table "${table}" already exists in schema`,
        resolution: 'pending-user-choice',
      })
    }
  }

  // existing auth packages/files
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

  const hasFullConflict =
    actions.some(a => a.level === 'full') ||
    (ctx.conflicts.existingAuthDetected && actions.length > 1)

  const level: ConflictLevel = hasFullConflict ? 'full' : actions.length > 0 ? 'partial' : 'none'

  return { level, actions, userTableAnalysis: analysis }
}
