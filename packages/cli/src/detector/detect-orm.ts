import path from 'node:path'
import type { Detected, ORM } from '../planning/types'
import { exists, readJSON } from '../shared/fs'

type PkgJSON = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function hasDep(pkg: PkgJSON, name: string): boolean {
  return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
}

export async function detectORM(projectRoot: string): Promise<Detected<ORM>> {
  const evidence: string[] = []

  // config files first — high confidence
  const drizzleConfig = ['drizzle.config.ts', 'drizzle.config.js']
  for (const file of drizzleConfig) {
    if (await exists(path.join(projectRoot, file))) {
      evidence.push(`found ${file}`)
      return { value: 'drizzle', confidence: 'high', evidence }
    }
  }

  if (await exists(path.join(projectRoot, 'prisma', 'schema.prisma'))) {
    evidence.push('found prisma/schema.prisma')
    return { value: 'prisma', confidence: 'high', evidence }
  }

  // fall back to deps
  try {
    const pkg = await readJSON<PkgJSON>(path.join(projectRoot, 'package.json'))

    const found: ORM[] = []

    if (hasDep(pkg, 'drizzle-orm')) {
      evidence.push('"drizzle-orm" in dependencies')
      found.push('drizzle')
    }
    if (hasDep(pkg, '@prisma/client') || hasDep(pkg, 'prisma')) {
      evidence.push('"prisma" in dependencies')
      found.push('prisma')
    }

    // conflicting ORMs — likely mid-migration
    if (found.length > 1) {
      evidence.push(`conflicting ORMs detected: ${found.join(', ')} — possibly mid-migration`)
      return { value: 'unknown', confidence: 'low', evidence }
    }

    if (found.length === 1) {
      return { value: found[0], confidence: 'medium', evidence }
    }

    // no ORM deps at all — this is a valid state
    evidence.push('no ORM deps found')
    return { value: 'none', confidence: 'high', evidence }
  } catch {
    /* no package.json */
  }

  evidence.push('could not read package.json')
  return { value: 'unknown', confidence: 'low', evidence }
}
