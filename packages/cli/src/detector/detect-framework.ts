import path from 'node:path'
import { exists, readJSON } from '../shared/fs'
import type { Detected, Framework } from '../planning/types'

type PkgJSON = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

// shared helper — checks both dep fields
function hasDep(pkg: PkgJSON, name: string): boolean {
  return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
}

export async function detectFramework(projectRoot: string): Promise<Detected<Framework>> {
  const evidence: string[] = []

  // config files are the strongest signal — they don't exist by accident
  const configSignals: Array<[string, Framework]> = [
    ['next.config.ts', 'nextjs'],
    ['next.config.js', 'nextjs'],
    ['next.config.mjs', 'nextjs'],
  ]

  for (const [file, framework] of configSignals) {
    if (await exists(path.join(projectRoot, file))) {
      evidence.push(`found ${file}`)
      // still check deps to add more evidence, but confidence is already high
      try {
        const pkg = await readJSON<PkgJSON>(path.join(projectRoot, 'package.json'))
        if (hasDep(pkg, 'next')) evidence.push('"next" in dependencies')
      } catch { /* no package.json */ }
      return { value: framework, confidence: 'high', evidence }
    }
  }

  // no config file — fall back to deps
  try {
    const pkg = await readJSON<PkgJSON>(path.join(projectRoot, 'package.json'))
    const depSignals: Array<[string, Framework]> = [
      ['next', 'nextjs'],
      ['express', 'express'],
      ['hono', 'hono'],
      ['fastify', 'fastify'],
    ]

    const found: Framework[] = []
    for (const [dep, framework] of depSignals) {
      if (hasDep(pkg, dep)) {
        evidence.push(`"${dep}" in dependencies`)
        found.push(framework)
      }
    }

    // conflicting deps — two frameworks in the same project
    if (found.length > 1) {
      evidence.push(`conflicting frameworks detected: ${found.join(', ')}`)
      return { value: 'unknown', confidence: 'low', evidence }
    }

    if (found.length === 1) {
      return { value: found[0], confidence: 'medium', evidence }
    }
  } catch { /* no package.json */ }

  evidence.push('no framework signals found')
  return { value: 'unknown', confidence: 'low', evidence }
}
