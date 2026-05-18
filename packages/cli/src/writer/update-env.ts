import path from 'node:path'
import { WriteError } from '../shared/errors'
import { exists, readText, writeText } from '../shared/fs'

// merges new env vars into .env without overwriting existing values
// if .env doesn't exist, creates it
// never overwrites a key that already has a value — user owns their secrets
//
// collectedValues: map of key → value collected from interactive prompts
// if a key is in collectedValues, that value is used instead of the default
export async function updateEnv(
  projectRoot: string,
  envVars: Array<{ key: string; description: string; example?: string }>,
  collectedValues: Map<string, string> = new Map(),
): Promise<void> {
  if (envVars.length === 0) return

  const envPath = path.join(projectRoot, '.env')
  const existing = (await exists(envPath)) ? await readText(envPath) : ''

  // parse existing keys so we don't overwrite them
  const existingKeys = new Set(
    existing
      .split('\n')
      .filter(line => line.includes('=') && !line.startsWith('#'))
      .map(line => line.split('=')[0].trim()),
  )

  const newLines: string[] = []

  const toAdd = envVars.filter(v => !existingKeys.has(v.key))
  if (toAdd.length === 0) return

  newLines.push('')
  newLines.push('# Added by sedim')

  for (const v of toAdd) {
    newLines.push(`# ${v.description}`)
    if (v.example) newLines.push(`# example: ${v.example}`)
    const value = collectedValues.get(v.key) ?? ''
    newLines.push(`${v.key}=${value}`)
  }

  try {
    await writeText(envPath, existing + newLines.join('\n') + '\n')
  } catch (err) {
    throw new WriteError(`Failed to update .env`, err)
  }
}
