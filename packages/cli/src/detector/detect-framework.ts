import path from 'node:path'
import type { Detected, Framework } from '../planning/types'
import { exists, readJSON } from '../shared/fs'

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
      } catch {
        /* no package.json */
      }
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
      if (depFramework === 'nextjs') {
        return { value: 'nextjs', confidence: 'medium', evidence }
      }
    }
  } catch {
    /* no package.json */
  }

  // AST pass — for Express/Hono/Fastify which have no config files
  if (depFramework && depFramework !== 'nextjs') {
    const astResult = await detectFrameworkFromAST(projectRoot, depFramework)
    if (astResult) {
      evidence.push(astResult)
      return { value: depFramework, confidence: 'high', evidence }
    }
    return { value: depFramework, confidence: 'medium', evidence }
  }

  // no deps found — try AST scan anyway
  const astFramework = await detectAnyFrameworkFromAST(projectRoot, evidence)
  if (astFramework) {
    return { value: astFramework, confidence: 'medium', evidence }
  }

  evidence.push('no framework signals found')
  return { value: 'unknown', confidence: 'low', evidence }
}

async function detectFrameworkFromAST(
  projectRoot: string,
  framework: Framework,
): Promise<string | null> {
  const patterns: Record<string, { call: string; files: string[] }> = {
    express: {
      call: 'express',
      files: [
        'src/app.ts',
        'src/app.js',
        'src/server.ts',
        'src/server.js',
        'src/index.ts',
        'src/index.js',
      ],
    },
    hono: { call: 'Hono', files: ['src/app.ts', 'src/app.js', 'src/index.ts', 'src/index.js'] },
    fastify: {
      call: 'fastify',
      files: [
        'src/app.ts',
        'src/app.js',
        'src/server.ts',
        'src/server.js',
        'src/index.ts',
        'src/index.js',
      ],
    },
  }

  const pattern = patterns[framework]
  if (!pattern) return null

  for (const file of pattern.files) {
    const filePath = path.join(projectRoot, file)
    if (!(await exists(filePath))) continue

    try {
      const { Project, SyntaxKind } = await loadTsMorph()
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: { allowJs: true },
      })
      const sf = project.addSourceFileAtPath(filePath)

      const isNewExpr = framework === 'hono'

      if (isNewExpr) {
        const found = sf
          .getDescendantsOfKind(SyntaxKind.NewExpression)
          .some(
            (n: { getExpression: () => { getText: () => string } }) =>
              n.getExpression().getText() === pattern.call,
          )
        if (found) return `found "new ${pattern.call}()" in ${file}`
      } else {
        const found = sf
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some(
            (c: { getExpression: () => { getText: () => string } }) =>
              c.getExpression().getText() === pattern.call,
          )
        if (found) return `found "${pattern.call}()" call in ${file}`
      }
    } catch {
      /* unreadable or not valid TS/JS */
    }
  }

  return null
}

async function detectAnyFrameworkFromAST(
  projectRoot: string,
  evidence: string[],
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

async function loadTsMorph() {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const { Project, SyntaxKind } = await import('ts-morph')
  return { Project, SyntaxKind }
}
