import path from 'node:path'
import { exists, readText } from '../shared/fs'
import type { CodeArchitecture } from '../planning/types'

// TODO: use ts-morph for AST-based detection in a later phase
// For now, file presence + text scanning is enough to unblock the detector

export async function detectCodeArchitecture(projectRoot: string): Promise<CodeArchitecture> {
  const [routerStyle, layoutStyle, appEntrypoint, apiDir, providersFile, hasBarrelExports, importStyle] =
    await Promise.all([
      resolveRouterStyle(projectRoot),
      resolveLayoutStyle(projectRoot),
      resolveAppEntrypoint(projectRoot),
      resolveApiDir(projectRoot),
      resolveProvidersFile(projectRoot),
      resolveBarrelExports(projectRoot),
      resolveImportStyle(projectRoot),
    ])

  return { routerStyle, layoutStyle, appEntrypoint, apiDir, providersFile, hasBarrelExports, importStyle }
}

async function resolveRouterStyle(projectRoot: string): Promise<CodeArchitecture['routerStyle']> {
  if (await exists(path.join(projectRoot, 'src/app')) || await exists(path.join(projectRoot, 'app'))) {
    return 'file-based'   // Next.js app/pages router
  }
  if (await exists(path.join(projectRoot, 'src/routes'))) {
    return 'file-based'   // SvelteKit-style
  }
  // check for centralized Express-style routing
  for (const candidate of ['src/app.ts', 'src/app.js', 'src/server.ts', 'src/server.js']) {
    if (await exists(path.join(projectRoot, candidate))) {
      return 'centralized'
    }
  }
  return 'unknown'
}

async function resolveLayoutStyle(projectRoot: string): Promise<CodeArchitecture['layoutStyle']> {
  if (
    await exists(path.join(projectRoot, 'src/app/layout.tsx')) ||
    await exists(path.join(projectRoot, 'src/app/layout.ts')) ||
    await exists(path.join(projectRoot, 'app/layout.tsx'))
  ) return 'app-router'

  if (
    await exists(path.join(projectRoot, 'src/pages/_app.tsx')) ||
    await exists(path.join(projectRoot, 'pages/_app.tsx'))
  ) return 'pages-router'

  return 'unknown'
}

async function resolveAppEntrypoint(projectRoot: string): Promise<CodeArchitecture['appEntrypoint']> {
  const candidates = ['src/app.ts', 'src/app.js', 'src/server.ts', 'src/server.js', 'src/index.ts', 'src/index.js']
  for (const candidate of candidates) {
    const filePath = path.join(projectRoot, candidate)
    if (await exists(filePath)) {
      try {
        const content = await readText(filePath)
        // look for express()/fastify()/hono() instantiation
        const exportsApp = /export (const|default) (app|server|hono)/.test(content)
        const exportName = content.match(/export const (\w+)\s*=\s*(express|fastify|new Hono)/)?.[1] ?? null
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
    await exists(path.join(projectRoot, 'src/index.ts')) ||
    await exists(path.join(projectRoot, 'src/index.js'))
  )
}

async function resolveImportStyle(projectRoot: string): Promise<CodeArchitecture['importStyle']> {
  // scan a few source files and check for default vs named exports
  const candidates = ['src/lib/utils.ts', 'src/utils.ts', 'src/lib/index.ts']
  for (const candidate of candidates) {
    const filePath = path.join(projectRoot, candidate)
    if (await exists(filePath)) {
      try {
        const content = await readText(filePath)
        const hasNamed = /export (const|function|class|type|interface)/.test(content)
        const hasDefault = /export default/.test(content)
        if (hasNamed && hasDefault) return 'mixed'
        if (hasDefault) return 'default'
        if (hasNamed) return 'named'
      } catch { /* unreadable */ }
    }
  }
  return 'named' // safe default for TS projects
}
