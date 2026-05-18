import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ModuleManifest } from '../planning/types'
import { DEFAULT_REGISTRY_URL } from '../shared/constants'
import { RegistryError } from '../shared/errors'
import { exists, readJSON } from '../shared/fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// fetches the module manifest — checks local registry first, then remote
// local registry lives at <repo-root>/registry/<module>/latest.json
// this allows development and offline use without hitting GitHub
export async function loadModuleManifest(
  moduleName: string,
  registryUrl = DEFAULT_REGISTRY_URL,
): Promise<ModuleManifest> {
  // local registry — walk up from cli/src/thinker to repo root
  const localPath = path.resolve(__dirname, '../../../../registry', moduleName, 'latest.json')
  if (await exists(localPath)) {
    try {
      return await readJSON<ModuleManifest>(localPath)
    } catch {
      // fall through to remote
    }
  }

  // remote registry
  const url = `${registryUrl}/${moduleName}/latest.json`
  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new RegistryError(
        `Module "${moduleName}" not found in registry (HTTP ${res.status})`,
        undefined,
        `Check available modules or verify the module name.`,
      )
    }
    return (await res.json()) as ModuleManifest
  } catch (err) {
    if (err instanceof RegistryError) throw err
    throw new RegistryError(`Failed to fetch manifest for "${moduleName}"`, err)
  }
}
