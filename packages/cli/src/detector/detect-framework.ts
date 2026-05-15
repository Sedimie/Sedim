import path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import { exists, readJSON } from '../shared/fs'
import type { Detected, Framework } from '../planning/types'

type PkgJSON = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function hasDep(pkg: PkgJSON, name: string): boolean {
  return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
}

export async function detectFramework(projectRoot: string): Promise<Detected<Framework>> {
  const evidence: string[] = []

  // config files — strongest signal, high confidence immediately
  const configSignals: Array<[string, Framework]> = [
    ['next.config.ts', 'nextjs'],
    ['next.config.js', 'nextjs'],
    ['next.config.mjs', 'nextjs'],
  ]

  for (const [file, framework] of configSignals) {
    if (await exists(path.join(projectRoot, file))) {
      evidence.push(`found ${file}`)
      try {
        const pkg = await readJSON<PkgJSON>(path.join(projectRoot, 'package.json'))
        if (hasDep(pkg, 'next')) evidence.push('"next" in dependencies')
      } catch { /* no package.json */ }
      return { value: framework, confidence: 'high', evidence }
    }
  }

  // deps check — medium confidence
  let depFramework: Framework | null = null
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

    if (found.length > 1) {
      evidence.push(`conflicting frameworks detected: ${found.join(', ')}`)
      return { value: 'unknown', confidence: 'low', evidence }
    }

    if (found.length === 1) {
      depFramework = found[0]
      // for Next.js, deps alone are enough — no entry file to scan
      if (depFramework === 'nextjs') {
        return { value: 'nextjs', confidence: 'medium', evidence }
      }
    }
  } catch { /* no package.json */ }

  // AST pass — for Express/Hono/Fastify which have no config files
  // scan likely entry files for framework instantiation calls
  // upgrades confidence from medium to high if found
  if (depFramework && depFramework !== 'nextjs') {
    const astResult = await detectFrameworkFromAST(projectRoot, depFramework)
    if (astResult) {
      evidence.push(astResult)
      return { value: depFramework, confidence: 'high', evidence }
    }
    // dep found but no AST confirmation — medium confidence
    return { value: depFramework, confidence: 'medium', evidence }
  }

  // no deps found — try AST scan anyway in case deps are missing
  const astFramework = await detectAnyFrameworkFromAST(projectRoot, evidence)
  if (astFramework) {
    return { value: astFramework, confidence: 'medium', evidence }
  }

  evidence.push('no framework signals found')
  return { value: 'unknown', confidence: 'low', evidence }
}

// scans entry files for a specific framework's instantiation pattern
// returns a description string if found, null if not
async function detectFrameworkFromAST(
  projectRoot: string,
  framework: Framework
): Promise<string | null> {
  const patterns: Record<string, { call: string; files: string[] }> = {
    express:  { call: 'express',  files: ['src/app.ts', 'src/app.js', 'src/server.ts', 'src/server.js', 'src/index.ts', 'src/index.js'] },
    hono:     { call: 'Hono',     files: ['src/app.ts', 'src/app.js', 'src/index.ts', 'src/index.js'] },
    fastify:  { call: 'fastify',  files: ['src/app.ts', 'src/app.js', 'src/server.ts', 'src/server.js', 'src/index.ts', 'src/index.js'] },
  }

  const pattern = patterns[framework]
  if (!pattern) return null

  for (const file of pattern.files) {
    const filePath = path.join(projectRoot, file)
    if (!(await exists(filePath))) continue

    try {
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: { allowJs: true },
      })
      const sf = project.addSourceFileAtPath(filePath)

      // look for call expressions matching the framework instantiation
      // express() — CallExpression where expression is Identifier 'express'
      // new Hono() — NewExpression where expression is Identifier 'Hono'
      // fastify() — CallExpression where expression is Identifier 'fastify'
      const isNewExpr = framework === 'hono'

      if (isNewExpr) {
        const found = sf
          .getDescendantsOfKind(SyntaxKind.NewExpression)
          .some(n => n.getExpression().getText() === pattern.call)
        if (found) return `found "new ${pattern.call}()" in ${file}`
      } else {
        const found = sf
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some(c => c.getExpression().getText() === pattern.call)
        if (found) return `found "${pattern.call}()" call in ${file}`
      }
    } catch { /* unreadable or not valid TS/JS */ }
  }

  return null
}

// tries all non-Next.js frameworks via AST when no deps were found
async function detectAnyFrameworkFromAST(
  projectRoot: string,
  evidence: string[]
): Promise<Framework | null> {
  const frameworks: Framework[] = ['express', 'hono', 'fastify']
  for (const fw of frameworks) {
    const result = await detectFrameworkFromAST(projectRoot, fw)
    if (result) {
      evidence.push(result)
      return fw
    }
  }
  return null
}
