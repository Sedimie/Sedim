import path from 'node:path'
import { Node, Project, SyntaxKind } from 'ts-morph'
import type { CodeArchitecture, InjectionAnchor, InjectionType } from '../planning/types'
import { exists } from '../shared/fs'

// ============================================================
// detect-code-architecture
// uses ts-morph AST analysis to find precise injection points
// not just file presence — actual code locations
// ============================================================

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

  // AST-based injection anchor detection
  // only runs on files that actually exist
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

// ============================================================
// File presence checks (unchanged from before)
// ============================================================

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
        // use ts-morph to check for framework instance exports
        const project = createProject()
        const sf = project.addSourceFileAtPath(filePath)
        const exportsApp = sf
          .getVariableDeclarations()
          .some(v => /express|fastify|new Hono/.test(v.getInitializerOrThrow()?.getText() ?? ''))
        const exportName =
          sf
            .getVariableDeclarations()
            .find(v => /express|fastify|new Hono/.test(v.getInitializerOrThrow()?.getText() ?? ''))
            ?.getName() ?? null
        return { file: candidate, exportsAppInstance: exportsApp, exportName }
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
        const project = createProject()
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

// ============================================================
// AST-based injection anchor resolution
// this is the new part — finds precise code locations
// ============================================================

async function resolveInjectionAnchors(
  projectRoot: string,
  ctx: {
    layoutStyle: CodeArchitecture['layoutStyle']
    appEntrypoint: CodeArchitecture['appEntrypoint']
    providersFile: string | null
  },
): Promise<Partial<Record<InjectionType, InjectionAnchor>>> {
  const anchors: Partial<Record<InjectionType, InjectionAnchor>> = {}

  // provider-wrap anchor — Next.js app router layout
  if (ctx.layoutStyle === 'app-router') {
    const layoutAnchor = await findProviderWrapAnchor(projectRoot)
    if (layoutAnchor) anchors['provider-wrap'] = layoutAnchor
  }

  // provider-wrap anchor — Next.js pages router _app
  if (ctx.layoutStyle === 'pages-router') {
    const appAnchor = await findPagesAppAnchor(projectRoot)
    if (appAnchor) anchors['provider-wrap'] = appAnchor
  }

  // middleware anchor — Express/Hono/Fastify app entry
  if (ctx.appEntrypoint) {
    const middlewareAnchor = await findMiddlewareAnchor(projectRoot, ctx.appEntrypoint.file)
    if (middlewareAnchor) anchors['middleware'] = middlewareAnchor
  }

  // route anchor — Express/Hono app entry
  if (ctx.appEntrypoint) {
    const routeAnchor = await findRouteAnchor(projectRoot, ctx.appEntrypoint.file)
    if (routeAnchor) anchors['route'] = routeAnchor
  }

  // import anchor — any file gets imports added at the end of the import block
  // this is resolved per-file at write time, not here
  // but we record the pattern the writer should use
  anchors['import'] = {
    file: '', // resolved per-file by the writer
    anchorText: '', // last import statement — found by writer
    position: 'after',
    description: 'after last import statement in file',
  }

  return anchors
}

// finds where to wrap children in Next.js app router layout
// looks for the <body> tag's children or the return statement's JSX root
async function findProviderWrapAnchor(projectRoot: string): Promise<InjectionAnchor | null> {
  const candidates = ['src/app/layout.tsx', 'src/app/layout.ts', 'app/layout.tsx']

  for (const candidate of candidates) {
    const filePath = path.join(projectRoot, candidate)
    if (!(await exists(filePath))) continue

    try {
      const project = createProject()
      const sf = project.addSourceFileAtPath(filePath)

      // find <body> JSX element — the children inside it is where providers wrap
      const bodyElements = sf
        .getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
        .filter(el => el.getTagNameNode().getText() === 'body')

      if (bodyElements.length > 0) {
        // anchor on the opening <body> tag text
        const bodyText = bodyElements[0].getText()
        return {
          file: candidate,
          anchorText: bodyText,
          position: 'after',
          description: 'after <body> opening tag in root layout',
        }
      }

      // fallback — anchor on the return statement if no <body> found
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
      /* unreadable or not valid TS */
    }
  }

  return null
}

// finds where to wrap Component in Next.js pages router _app
async function findPagesAppAnchor(projectRoot: string): Promise<InjectionAnchor | null> {
  const candidates = ['src/pages/_app.tsx', 'pages/_app.tsx']

  for (const candidate of candidates) {
    const filePath = path.join(projectRoot, candidate)
    if (!(await exists(filePath))) continue

    try {
      const project = createProject()
      const sf = project.addSourceFileAtPath(filePath)

      // look for <Component {...pageProps} /> — standard _app pattern
      const jsxElements = sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
      const componentEl = jsxElements.find(el => el.getTagNameNode().getText() === 'Component')

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

// finds where to register middleware in Express/Hono/Fastify entry
async function findMiddlewareAnchor(
  projectRoot: string,
  entryFile: string,
): Promise<InjectionAnchor | null> {
  const filePath = path.join(projectRoot, entryFile)
  if (!(await exists(filePath))) return null

  try {
    const project = createProject()
    const sf = project.addSourceFileAtPath(filePath)

    // find all app.use() calls — middleware goes after the last one
    const useCallExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => {
      const expr = call.getExpression()
      return Node.isPropertyAccessExpression(expr) && expr.getName() === 'use'
    })

    if (useCallExpressions.length > 0) {
      // anchor after the last app.use() call
      const lastUse = useCallExpressions[useCallExpressions.length - 1]
      // get the full statement text (includes the semicolon)
      const statement = lastUse.getParentIfKind(SyntaxKind.ExpressionStatement)
      const anchorText = statement?.getText() ?? lastUse.getText()

      return {
        file: entryFile,
        anchorText,
        position: 'after',
        description: 'after last app.use() middleware registration',
      }
    }

    // no app.use() found — anchor after the app instance declaration
    const appDecl = sf
      .getVariableDeclarations()
      .find(v =>
        /express\(\)|new Hono|fastify\(\)/.test(v.getInitializerOrThrow()?.getText() ?? ''),
      )

    if (appDecl) {
      const statement = appDecl
        .getParentIfKind(SyntaxKind.VariableDeclarationList)
        ?.getParentIfKind(SyntaxKind.VariableStatement)
      const anchorText = statement?.getText() ?? appDecl.getText()
      return {
        file: entryFile,
        anchorText,
        position: 'after',
        description: 'after app instance declaration',
      }
    }
  } catch {
    /* unreadable */
  }

  return null
}

// finds where to register routes in Express/Hono/Fastify entry
async function findRouteAnchor(
  projectRoot: string,
  entryFile: string,
): Promise<InjectionAnchor | null> {
  const filePath = path.join(projectRoot, entryFile)
  if (!(await exists(filePath))) return null

  try {
    const project = createProject()
    const sf = project.addSourceFileAtPath(filePath)

    // find route registrations: app.get/post/put/delete/use with path strings
    const routeCalls = sf
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => {
        const expr = call.getExpression()
        if (!Node.isPropertyAccessExpression(expr)) return false
        const method = expr.getName()
        return ['get', 'post', 'put', 'delete', 'patch', 'use', 'route'].includes(method)
      })
      // only calls where first arg is a string (path) — filters out middleware-only use()
      .filter(call => {
        const firstArg = call.getArguments()[0]
        return firstArg && Node.isStringLiteral(firstArg)
      })

    if (routeCalls.length > 0) {
      const lastRoute = routeCalls[routeCalls.length - 1]
      const statement = lastRoute.getParentIfKind(SyntaxKind.ExpressionStatement)
      const anchorText = statement?.getText() ?? lastRoute.getText()
      return {
        file: entryFile,
        anchorText,
        position: 'after',
        description: 'after last route registration',
      }
    }
  } catch {
    /* unreadable */
  }

  return null
}

// ============================================================
// shared ts-morph project factory
// skipAddingFilesFromTsConfig: true — we add files manually
// we don't want ts-morph scanning the whole project on every call
// ============================================================

function createProject(): Project {
  return new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      jsx: 4, // JsxEmit.ReactJSX
    },
  })
}
