import path from 'node:path'
import type { InjectionAction } from '../planning/types'
import { WriteError } from '../shared/errors'
import { exists, readText, writeText } from '../shared/fs'
import { backupFile } from './patch-file'

// injects a code payload at an anchor point in a file
// anchor is the exact text to find — payload goes before or after it
// backs up the file before modifying
export async function injectCode(
  projectRoot: string,
  action: InjectionAction,
  backup = true,
): Promise<'injected' | 'skipped'> {
  const absPath = path.join(projectRoot, action.file)

  if (!(await exists(absPath))) {
    throw new WriteError(
      `Cannot inject into "${action.file}" — file does not exist`,
      undefined,
      'Check that the file path in the plan is correct.',
    )
  }

  if (backup) await backupFile(projectRoot, action.file)

  try {
    const content = await readText(absPath)

    const injected = applyInjection(content, action)

    await writeText(absPath, injected)
    return 'injected'
  } catch (err) {
    if (err instanceof WriteError) throw err
    throw new WriteError(`Failed to inject code into ${action.file}`, err)
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Converts a strict text anchor into a highly flexible regex
// Allows arbitrary whitespace, newlines, and trailing commas/semicolons
export function buildAnchorRegex(anchor: string): RegExp {
  // Normalize extra newlines/spaces into single spaces for split
  const parts = anchor.trim().split(/\s+/)
  const escapedParts = parts.map(escapeRegExp)

  // Make quotes completely agnostic (single or double)
  const quoteAgnostic = escapedParts.map(p => p.replace(/['"]/g, `['"]`))

  // Join all parts with optional whitespace/newlines
  const pattern = quoteAgnostic.join('\\s+') + '\\s*[,;]?'

  return new RegExp(pattern, 'm')
}

export function applyInjection(content: string, action: InjectionAction): string {
  if (content.includes(action.payload.trim())) {
    return content // idempotent
  }

  // 1st try: strict exact match (fast)
  if (content.includes(action.anchor)) {
    return action.position === 'after'
      ? content.replace(action.anchor, `${action.anchor}\n${action.payload}`)
      : content.replace(action.anchor, `${action.payload}\n${action.anchor}`)
  }

  // 2nd try: flexible regex match (slower but formatter-agnostic)
  const flexibleRegex = buildAnchorRegex(action.anchor)
  const match = content.match(flexibleRegex)

  if (!match) {
    throw new WriteError(
      `Injection anchor not found in "${action.file}"`,
      undefined,
      `Expected to find something like: ${action.anchor.slice(0, 80)}\n\nYou may need to add this manually.`,
    )
  }

  const matchedString = match[0]
  return action.position === 'after'
    ? content.replace(matchedString, `${matchedString}\n${action.payload}`)
    : content.replace(matchedString, `${action.payload}\n${matchedString}`)
}
