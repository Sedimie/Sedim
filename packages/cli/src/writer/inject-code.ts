import path from 'node:path'
import { exists, readText, writeText } from '../shared/fs'
import { WriteError } from '../shared/errors'
import { backupFile } from './patch-file'
import type { InjectionAction } from '../planning/types'

// injects a code payload at an anchor point in a file
// anchor is the exact text to find — payload goes before or after it
// backs up the file before modifying
export async function injectCode(
  projectRoot: string,
  action: InjectionAction,
  backup = true
): Promise<'injected' | 'skipped'> {
  const absPath = path.join(projectRoot, action.file)

  if (!(await exists(absPath))) {
    throw new WriteError(
      `Cannot inject into "${action.file}" — file does not exist`,
      undefined,
      'Check that the file path in the plan is correct.'
    )
  }

  if (backup) await backupFile(projectRoot, action.file)

  try {
    const content = await readText(absPath)

    // check if payload is already present — idempotent
    if (content.includes(action.payload.trim())) {
      return 'skipped'
    }

    if (!content.includes(action.anchor)) {
      throw new WriteError(
        `Injection anchor not found in "${action.file}"`,
        undefined,
        `Expected to find: ${action.anchor.slice(0, 80)}\n\nYou may need to add this manually.`
      )
    }

    const injected = action.position === 'after'
      ? content.replace(action.anchor, `${action.anchor}\n${action.payload}`)
      : content.replace(action.anchor, `${action.payload}\n${action.anchor}`)

    await writeText(absPath, injected)
    return 'injected'
  } catch (err) {
    if (err instanceof WriteError) throw err
    throw new WriteError(`Failed to inject code into ${action.file}`, err)
  }
}
