import path from 'node:path'
import { WriteError } from '../shared/errors'
import { exists, readText, writeText } from '../shared/fs'

// writes a backup of a file before modifying it
// backup lives at <file>.sedim.bak — user can restore manually if needed
export async function backupFile(projectRoot: string, filePath: string): Promise<string> {
  const absPath = path.join(projectRoot, filePath)
  const backupPath = `${absPath}.sedim.bak`

  try {
    const content = await readText(absPath)
    await writeText(backupPath, content)
    return backupPath
  } catch (err) {
    throw new WriteError(`Failed to backup ${filePath}`, err)
  }
}

// applies a text replacement to a file
// used for simple patch operations where the thinker knows
// exactly what text to find and replace
export async function patchFile(
  projectRoot: string,
  filePath: string,
  find: string,
  replace: string,
  backup = true,
): Promise<void> {
  const absPath = path.join(projectRoot, filePath)

  if (!(await exists(absPath))) {
    throw new WriteError(
      `Cannot patch "${filePath}" — file does not exist`,
      undefined,
      'Check that the file path in the plan is correct.',
    )
  }

  if (backup) await backupFile(projectRoot, filePath)

  try {
    const content = await readText(absPath)
    if (!content.includes(find)) {
      throw new WriteError(
        `Patch anchor not found in "${filePath}"`,
        undefined,
        `Expected to find: ${find.slice(0, 80)}...`,
      )
    }
    await writeText(absPath, content.replace(find, replace))
  } catch (err) {
    if (err instanceof WriteError) throw err
    throw new WriteError(`Failed to patch ${filePath}`, err)
  }
}
