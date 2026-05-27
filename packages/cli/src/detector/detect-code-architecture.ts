import path from 'node:path'
import type { CodeArchitecture, InjectionAnchor, InjectionType } from '../planning/types'
import { exists } from '../shared/fs'

export async function detectCodeArchitecture(projectRoot: string): Promise<CodeArchitecture> {
  const [
    routerStyle,
    layoutStyle,
    appEntrypoint,
    apiDir,
    providersFile,
    hasBarrelExports,
    importStyle,
  ] = await Promise.all([
    resolveRouterStyle(projectRoot),
    resolveLayoutStyle(projectRoot),
    resolveAppEntrypoint(projectRoot),
    resolveApiDir(projectRoot),
    resolveProvidersFile(projectRoot),
    resolveBarrelExports(projectRoot),
    resolveImportStyle(projectRoot),
  ])

  const injectionAnchors = await resolveInjectionAnchors(projectRoot, {
    layoutStyle,
    appEntrypoint,
    providersFile,
  })

  return {
    routerStyle,
    layoutStyle,
    appEntrypoint,
    apiDir,
    providersFile,
    hasBarrelExports,
    importStyle,
    injectionAnchors,
  }
}

async function resolveRouterStyle(projectRoot: string): Promise<CodeArchitecture['routerStyle']> {
  if (
    (await exists(path.join(projectRoot, 'src/app'))) ||
    (await exists(path.join(projectRoot, 'app')))
  ) {
    return 'file-based'
  }
  if (await exists(path.join(projectRoot, 'src/routes'))) return 'file-based'
  for (const candidate of ['src/app.ts', 'src/app.js', 'src/server.ts', 'src/server.js']) {
    if (await exists(path.join(projectRoot, candidate))) return 'centralized'
  }
  return 'unknown'
}

async function resolveLayoutStyle(projectRoot: string): Promise<CodeArchitecture['layoutStyle']> {
  if (
    (await exists(path.join(projectRoot, 'src/app/layout.tsx'))) ||
    (await exists(path.join(projectRoot, 'src/app/layout.ts'))) ||
    (await exists(path.join(projectRoot, 'app/layout.tsx')))
  )
    return 'app-router'
  if (
    (await exists(path.join(projectRoot, 'src/pages/_app.tsx'))) ||
    (await exists(path.join(projectRoot, 'pages/_app.tsx')))
  )
    return 'pages-router'
  return 'unknown'
}

async function resolveAppEntrypoint(
  projectRoot: string,
): Promise<CodeArchitecture['appEntrypoint']> {
  const candidates = [
    'src/app.ts',
    'src/app.js',
    'src/server.ts',
    'src/server.js',
    'src/index.ts',
    'src/index.js',
  ]
  for (const candidate of candidates) {
    const filePath = path.join(projectRoot, candidate)
    if (await exists(filePath)) {
      try {
        const { Project } = await loadTsMorph()
        const project = new Project({
          skipAddingFilesFromTsConfig: true,
          compilerOptions: { allowJs: true },
        })
        const sf = project.addSourceFileAtPath(filePath)
        const exportsApp = sf
          .getVariableDeclarations()
          .some((v: { getInitializerOrThrow: () => { getText: () => string } }) =>
            /express|fastify|new Hono/.test(v.getInitializerOrThrow()?.getText() ?? ''),
          )
        const exportEntry = sf
          .getVariableDeclarations()
          .find((v: { getInitializerOrThrow: () => { getText: () => string } }) =>
            /express|fastify|new Hono/.test(v.getInitializerOrThrow()?.getText() ?? ''),
          )
        return {
          file: candidate,
          exportsAppInstance: exportsApp,
          exportName: exportEntry?.getName() ?? null,
        }
      } catch {
        return { file: candidate, exportsAppInstance: false, exportName: null }
      }
    }
  }
  return null
}

async function resolveApiDir(projectRoot: string): Promise<string | null> {
  const candidates = ['src/app/api', 'app/api', 'src/pages/api', 'pages/api']
  for (const candidate of candidates) {
    if (await exists(path.join(projectRoot, candidate))) return candidate
  }
  return null
}

async function resolveProvidersFile(projectRoot: string): Promise<string | null> {
  const candidates = ['src/app/providers.tsx', 'src/components/providers.tsx', 'src/providers.tsx']
  for (const candidate of candidates) {
    if (await exists(path.join(projectRoot, candidate))) return candidate
  }
  return null
}

async function resolveBarrelExports(projectRoot: string): Promise<boolean> {
  return (
    (await exists(path.join(projectRoot, 'src/index.ts'))) ||
    (await exists(path.join(projectRoot, 'src/index.js')))
  )
}

async function resolveImportStyle(projectRoot: string): Promise<CodeArchitecture['importStyle']> {
  const candidates = ['src/lib/utils.ts', 'src/utils.ts', 'src/lib/index.ts']
  for (const candidate of candidates) {
    const filePath = path.join(projectRoot, candidate)
    if (await exists(filePath)) {
      try {
        const { Project } = await loadTsMorph()
        const project = new Project({
          skipAddingFilesFromTsConfig: true,
          compilerOptions: { allowJs: true },
        })
        const sf = project.addSourceFileAtPath(filePath)
        const hasNamed = sf.getExportedDeclarations().size > 0
        const hasDefault = sf.getDefaultExportSymbol() !== undefined
        if (hasNamed && hasDefault) return 'mixed'
        if (hasDefault) return 'default'
        if (hasNamed) return 'named'
      } catch {
        /* unreadable */
      }
    }
  }
  return 'named'
}

async function resolveInjectionAnchors(
  projectRoot: string,
  ctx: {
    layoutStyle: CodeArchitecture['layoutStyle']
    appEntrypoint: CodeArchitecture['appEntrypoint']
    providersFile: string | null
  },
): Promise<Partial<Record<InjectionType, InjectionAnchor>>> {
  const anchors: Partial<Record<InjectionType, InjectionAnchor>> = {}

  if (ctx.layoutStyle === 'app-router') {
    const anchor = await findProviderWrapAnchor(projectRoot)
    if (anchor) anchors['provider-wrap'] = anchor
  }
  if (ctx.layoutStyle === 'pages-router') {
    const anchor = await findPagesAppAnchor(projectRoot)
    if (anchor) anchors['provider-wrap'] = anchor
  }
  if (ctx.appEntrypoint) {
    const mwAnchor = await findMiddlewareAnchor(projectRoot, ctx.appEntrypoint.file)
    if (mwAnchor) anchors['middleware'] = mwAnchor
  }
  if (ctx.appEntrypoint) {
    const routeAnchor = await findRouteAnchor(projectRoot, ctx.appEntrypoint.file)
    if (routeAnchor) anchors['route'] = routeAnchor
  }

  anchors['import'] = {
    file: '',
    anchorText: '',
    position: 'after',
    description: 'after last import statement in file',
  }

  return anchors
}

async function findProviderWrapAnchor(projectRoot: string): Promise<InjectionAnchor | null> {
  const candidates = ['src/app/layout.tsx', 'src/app/layout.ts', 'app/layout.tsx']
  for (const candidate of candidates) {
    const filePath = path.join(projectRoot, candidate)
    if (!(await exists(filePath))) continue
    try {
      const { Project, SyntaxKind } = await loadTsMorph()
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: { allowJs: true, jsx: 4 },
      })
      const sf = project.addSourceFileAtPath(filePath)
      const bodyElements = sf
        .getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
        .filter(
          (el: { getTagNameNode: () => { getText: () => string } }) =>
            el.getTagNameNode().getText() === 'body',
        )
      if (bodyElements.length > 0) {
        return {
          file: candidate,
          anchorText: bodyElements[0].getText(),
          position: 'after',
          description: 'after <body> opening tag in root layout',
        }
      }
      const returnStatements = sf.getDescendantsOfKind(SyntaxKind.ReturnStatement)
      if (returnStatements.length > 0) {
        return {
          file: candidate,
          anchorText: 'return (',
          position: 'after',
          description: 'after return statement in root layout',
        }
      }
    } catch {
      /* unreadable */
    }
  }
  return null
}

async function findPagesAppAnchor(projectRoot: string): Promise<InjectionAnchor | null> {
  const candidates = ['src/pages/_app.tsx', 'pages/_app.tsx']
  for (const candidate of candidates) {
    const filePath = path.join(projectRoot, candidate)
    if (!(await exists(filePath))) continue
    try {
      const { Project, SyntaxKind } = await loadTsMorph()
      const project = new Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: { allowJs: true },
      })
      const sf = project.addSourceFileAtPath(filePath)
      const jsxElements = sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
      const componentEl = jsxElements.find(
        (el: { getTagNameNode: () => { getText: () => string } }) =>
          el.getTagNameNode().getText() === 'Component',
      )
      if (componentEl) {
        return {
          file: candidate,
          anchorText: componentEl.getText(),
          position: 'before',
          description: 'wrapping <Component> in pages/_app',
        }
      }
    } catch {
      /* unreadable */
    }
  }
  return null
}

async function findMiddlewareAnchor(
  projectRoot: string,
  entryFile: string,
): Promise<InjectionAnchor | null> {
  const filePath = path.join(projectRoot, entryFile)
  if (!(await exists(filePath))) return null
  try {
    const { Project, SyntaxKind, Node } = await loadTsMorph()
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    })
    const sf = project.addSourceFileAtPath(filePath)
    const useCallExpressions = sf
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call: { getExpression: () => { getName: () => string } }) => {
        const expr = call.getExpression()
        return Node.isPropertyAccessExpression(expr) && expr.getName() === 'use'
      })
    if (useCallExpressions.length > 0) {
      const lastUse = useCallExpressions[useCallExpressions.length - 1]
      const statement = lastUse.getParentIfKind(SyntaxKind.ExpressionStatement)
      return {
        file: entryFile,
        anchorText: statement?.getText() ?? lastUse.getText(),
        position: 'after',
        description: 'after last app.use() middleware registration',
      }
    }
    const appDecl = sf
      .getVariableDeclarations()
      .find((v: { getInitializerOrThrow: () => { getText: () => string } }) =>
        /express\(\)|new Hono|fastify\(\)/.test(v.getInitializerOrThrow()?.getText() ?? ''),
      )
    if (appDecl) {
      const statement = appDecl
        .getParentIfKind?.(SyntaxKind.VariableDeclarationList)
        ?.getParentIfKind?.(SyntaxKind.VariableStatement)
      return {
        file: entryFile,
        anchorText: statement?.getText() ?? appDecl.getText(),
        position: 'after',
        description: 'after app instance declaration',
      }
    }
  } catch {
    /* unreadable */
  }
  return null
}

async function findRouteAnchor(
  projectRoot: string,
  entryFile: string,
): Promise<InjectionAnchor | null> {
  const filePath = path.join(projectRoot, entryFile)
  if (!(await exists(filePath))) return null
  try {
    const { Project, SyntaxKind, Node } = await loadTsMorph()
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    })
    const sf = project.addSourceFileAtPath(filePath)
    const routeCalls = sf
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call: { getExpression: () => unknown }) => {
        const expr = call.getExpression()
        if (!Node.isPropertyAccessExpression(expr)) return false
        return ['get', 'post', 'put', 'delete', 'patch', 'use', 'route'].includes(
          (expr as { getName: () => string }).getName(),
        )
      })
      .filter((call: { getArguments: () => unknown[] }) => {
        const firstArg = call.getArguments()[0]
        return (
          firstArg && Node.isStringLiteral(firstArg as Parameters<typeof Node.isStringLiteral>[0])
        )
      })
    if (routeCalls.length > 0) {
      const lastRoute = routeCalls[routeCalls.length - 1]
      const statement = lastRoute.getParentIfKind(SyntaxKind.ExpressionStatement)
      return {
        file: entryFile,
        anchorText: statement?.getText() ?? lastRoute.getText(),
        position: 'after',
        description: 'after last route registration',
      }
    }
  } catch {
    /* unreadable */
  }
  return null
}

async function loadTsMorph() {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const { Project, SyntaxKind, Node } = await import('ts-morph')
  return { Project, SyntaxKind, Node }
}
