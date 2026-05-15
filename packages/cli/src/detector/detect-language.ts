import { readdir } from 'node:fs/promises'
import path from 'node:path'
import type { Detected, Language, ModuleSystem } from '../planning/types'
import { exists, readJSON } from '../shared/fs'

export async function detectLanguage(projectRoot: string): Promise<Detected<Language>> {
  const evidence: string[] = []

  if (await exists(path.join(projectRoot, 'tsconfig.json'))) {
    evidence.push('found tsconfig.json')
    return { value: 'typescript', confidence: 'high', evidence }
  }

  // no tsconfig — scan src/ for .ts files as a weaker signal
  const srcDir = path.join(projectRoot, 'src')
  if (await exists(srcDir)) {
    const files = await readdir(srcDir)
    const hasTS = files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))
    if (hasTS) {
      evidence.push('found .ts files in src/')
      return { value: 'typescript', confidence: 'medium', evidence }
    }
  }

  evidence.push('no tsconfig.json or .ts files found')
  return { value: 'javascript', confidence: 'medium', evidence }
}

export async function detectModuleSystem(projectRoot: string): Promise<Detected<ModuleSystem>> {
  const evidence: string[] = []

  try {
    const pkg = await readJSON<{ type?: string }>(path.join(projectRoot, 'package.json'))
    if (pkg.type === 'module') {
      evidence.push('"type": "module" in package.json')
      return { value: 'esm', confidence: 'high', evidence }
    }
    if (pkg.type === 'commonjs') {
      evidence.push('"type": "commonjs" in package.json')
      return { value: 'cjs', confidence: 'high', evidence }
    }
  } catch {
    /* no package.json, fall through */
  }

  try {
    const tsconfig = await readJSON<{ compilerOptions?: { module?: string } }>(
      path.join(projectRoot, 'tsconfig.json'),
    )
    const mod = tsconfig.compilerOptions?.module?.toLowerCase() ?? ''
    if (
      mod.includes('esnext') ||
      mod.includes('node16') ||
      mod.includes('nodenext') ||
      mod.includes('bundler')
    ) {
      evidence.push(`tsconfig module: "${tsconfig.compilerOptions?.module}"`)
      return { value: 'esm', confidence: 'medium', evidence }
    }
    if (mod.includes('commonjs')) {
      evidence.push(`tsconfig module: "${tsconfig.compilerOptions?.module}"`)
      return { value: 'cjs', confidence: 'medium', evidence }
    }
  } catch {
    /* no tsconfig, fall through */
  }

  evidence.push('no explicit module system found')
  return { value: 'unknown', confidence: 'low', evidence }
}
