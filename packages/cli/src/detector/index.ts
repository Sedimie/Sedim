import path from 'node:path'
import type { DetectedContext } from '../planning/types'
import { DetectionError } from '../shared/errors'
import { exists, findProjectRoot, readJSON, readText } from '../shared/fs'
import { detectPackageManager } from '../shared/package-manager'
import { detectAuthSignals } from './detect-auth-signals'
import { detectCodeArchitecture } from './detect-code-architecture'
import { detectDB } from './detect-db'
import { detectFramework } from './detect-framework'
import { detectLanguage, detectModuleSystem } from './detect-language'
import { detectORM } from './detect-orm'
import { detectStructure } from './detect-structure'

export async function detect(from?: string): Promise<DetectedContext> {
  const projectRoot = await findProjectRoot(from)

  // run all detectors in parallel — none depend on each other
  const [language, moduleSystem, framework, orm, db, structure, schema, codeArchitecture] =
    await Promise.all([
      detectLanguage(projectRoot),
      detectModuleSystem(projectRoot),
      detectFramework(projectRoot),
      detectORM(projectRoot),
      detectDB(projectRoot),
      detectStructure(projectRoot),
      detectAuthSignals(projectRoot),
      detectCodeArchitecture(projectRoot),
    ]).catch(err => {
      throw new DetectionError('Detection failed', err)
    })

  const packageManager = detectPackageManager(projectRoot)
  const nodeVersion = await resolveNodeVersion(projectRoot)

  const conflicts = {
    level: schema.existingAuthDetected ? ('partial' as const) : ('none' as const),
    existingAuthDetected: schema.existingAuthDetected,
    signals: schema.authSignals,
  }

  return {
    projectRoot,
    packageManager,
    language,
    moduleSystem,
    framework,
    orm,
    db,
    structure,
    schema,
    codeArchitecture,
    runtime: { nodeVersion },
    conflicts,
  }
}

async function resolveNodeVersion(projectRoot: string): Promise<string | null> {
  const nvmrc = path.join(projectRoot, '.nvmrc')
  if (await exists(nvmrc)) {
    try {
      return (await readText(nvmrc)).trim()
    } catch {
      /* unreadable */
    }
  }
  try {
    const pkg = await readJSON<{ engines?: { node?: string } }>(
      path.join(projectRoot, 'package.json'),
    )
    if (pkg.engines?.node) return pkg.engines.node
  } catch {
    /* no package.json */
  }
  return null
}
