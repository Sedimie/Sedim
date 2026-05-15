import { DEFAULT_REGISTRY_URL } from '../shared/constants'
import { RegistryError } from '../shared/errors'
import type { ModuleManifest } from '../planning/types'

// fetches the module manifest JSON from the registry
// registry is a GitHub repo: /modules/<name>/latest.json
export async function loadModuleManifest(
  moduleName: string,
  registryUrl = DEFAULT_REGISTRY_URL
): Promise<ModuleManifest> {
  const url = `${registryUrl}/${moduleName}/latest.json`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      throw new RegistryError(
        `Module "${moduleName}" not found in registry (HTTP ${res.status})`,
        undefined,
        `Check available modules or verify the module name.`
      )
    }
    return (await res.json()) as ModuleManifest
  } catch (err) {
    if (err instanceof RegistryError) throw err
    throw new RegistryError(`Failed to fetch manifest for "${moduleName}"`, err)
  }
}
