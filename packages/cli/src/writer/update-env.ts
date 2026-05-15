import path from 'node:path'
import { exists, readText, writeText } from '../shared/fs'
import { WriteError } from '../shared/errors'

// merges new env vars into .env without overwriting existing values
// if .env doesn't exist, creates it
// never overwrites a key that already has a value — user owns their secrets
export async function updateEnv(
  projectRoot: string,
  envVars: Array<{ key: string; description: string; example?: string }>
): Promise<void> {
  if (envVars.length === 0) return

  const envPath = path.join(projectRoot, '.env')
  const existing = (await exists(envPath)) ? await readText(envPath) : ''

  // parse existing keys so we don't overwrite them
  const existingKeys = new Set(
    existing
      .split('\n')
      .filter(line => line.includes('=') && !line.startsWith('#'))
      .map(line => line.split('=')[0].trim())
  )

  const newLines: string[] = []

  // add a section header if we're adding anything
  const toAdd = envVars.filter(v => !existingKeys.has(v.key))
  if (toAdd.length === 0) return

  newLines.push('')
  newLines.push('# Added by sedim')

  for (const v of toAdd) {
    newLines.push(`# ${v.description}`)
    const placeholder = v.example ? `# example: ${v.example}` : null
    if (placeholder) newLines.push(placeholder)
    newLines.push(`${v.key}=`)
  }

  try {
    await writeText(envPath, existing + newLines.join('\n') + '\n')
  } catch (err) {
    throw new WriteError(`Failed to update .env`, err)
  }
}
