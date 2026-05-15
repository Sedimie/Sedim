import type { InstallPlan } from '../planning/types'
import { WriteError } from '../shared/errors'
import { installDependencies } from '../shared/package-manager'
import { injectCode } from './inject-code'
import { injectImport } from './inject-imports'
import { updateEnv } from './update-env'
import { writeFile } from './write-file'

// executes an approved InstallPlan against the filesystem
// order matters:
//   1. dependencies first — templates may need them to be resolvable
//   2. create files — new files before injections that reference them
//   3. inject imports — before injecting code that uses those imports
//   4. inject code — routes, middleware, provider wraps
//   5. env vars last — additive only, never destructive
export async function applyPlan(projectRoot: string, plan: InstallPlan): Promise<void> {
  // ── 1. install dependencies ──────────────────────────────
  if (plan.dependenciesToInstall.length > 0) {
    try {
      await installDependencies(plan.dependenciesToInstall, projectRoot, false)
    } catch (err) {
      throw new WriteError(`Failed to install dependencies`, err)
    }
  }

  if (plan.devDependenciesToInstall.length > 0) {
    try {
      await installDependencies(plan.devDependenciesToInstall, projectRoot, true)
    } catch (err) {
      throw new WriteError(`Failed to install dev dependencies`, err)
    }
  }

  // ── 2. create files ──────────────────────────────────────
  for (const file of plan.filesToCreate) {
    // conflict resolution should have been done by the command layer
    // by this point all conflictActions with 'pending-user-choice'
    // should have been resolved to 'skip' or 'overwrite'
    const conflictAction = plan.conflictActions.find(c => c.file === file.path)
    const strategy = conflictAction?.resolution === 'skip' ? 'skip' : 'overwrite'

    await writeFile(projectRoot, file, strategy)
  }

  // ── 3. inject imports ────────────────────────────────────
  // import injections are separated from other injections
  // because they need to go at the top of the file, not at an anchor
  const importInjections = plan.injectionActions.filter(a => a.type === 'import')
  for (const action of importInjections) {
    await injectImport(projectRoot, action.file, action.payload)
  }

  // ── 4. inject code ───────────────────────────────────────
  // all other injection types: route, provider-wrap, middleware, env-var
  const codeInjections = plan.injectionActions.filter(a => a.type !== 'import')
  for (const action of codeInjections) {
    await injectCode(projectRoot, action)
  }

  // ── 5. update env ────────────────────────────────────────
  await updateEnv(projectRoot, plan.envVarsToAdd)
}
