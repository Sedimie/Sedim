import path from 'node:path'
import { exists, writeText, readText } from '../shared/fs'
import { WriteError } from '../shared/errors'
import type { FileToCreate } from '../planning/types'

// creates a new file from a FileToCreate action
// respects the overwriteStrategy — caller must have already resolved 'ask'
// to either 'skip' or 'overwrite' before calling this
export async function writeFile(
  projectRoot: string,
  file: FileToCreate,
  overwriteStrategy: 'skip' | 'overwrite' = 'overwrite'
): Promise<'created' | 'skipped'> {
  const filePath = path.join(projectRoot, file.path)
  const fileExists = await exists(filePath)

  if (fileExists && overwriteStrategy === 'skip') {
    return 'skipped'
  }

  // content must be pre-rendered by the time it reaches the writer
  // if content is missing, the thinker didn't do its job
  if (!file.content) {
    throw new WriteError(
      `No content for file "${file.path}" — template was not rendered`,
      undefined,
      'This is a bug in the module plan-config. Report it.'
    )
  }

  try {
    await writeText(filePath, file.content)
    return 'created'
  } catch (err) {
    throw new WriteError(`Failed to write ${file.path}`, err)
  }
}
