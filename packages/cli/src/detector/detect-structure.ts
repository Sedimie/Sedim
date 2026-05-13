import path from 'node:path'
import { exists } from '../shared/fs'
import type { ProjectStructure } from '../planning/types'

export async function detectStructure(projectRoot: string): Promise<ProjectStructure> {
  const srcDir = await resolveSrcDir(projectRoot)
  const routeEntrypoints = await resolveRouteEntrypoints(projectRoot, srcDir)
  const middlewareCandidates = await resolveMiddlewareCandidates(projectRoot, srcDir)

  return { srcDir, routeEntrypoints, middlewareCandidates }
}

async function resolveSrcDir(projectRoot: string): Promise<string | null> {
  // src/ is the most common convention
  if (await exists(path.join(projectRoot, 'src'))) return 'src'
  // Next.js app router without src/ — app/ at root
  if (await exists(path.join(projectRoot, 'app'))) return '.'
  return null
}

async function resolveRouteEntrypoints(projectRoot: string, srcDir: string | null): Promise<string[]> {
  const candidates = [
    'src/app',          // Next.js app router with src/
    'app',              // Next.js app router without src/
    'src/pages',        // Next.js pages router with src/
    'pages',            // Next.js pages router without src/
    'src/routes',       // SvelteKit / custom Express route dirs
    'src/api',          // standalone API dirs
  ]

  const found: string[] = []
  for (const candidate of candidates) {
    if (await exists(path.join(projectRoot, candidate))) {
      found.push(candidate)
    }
  }
  return found
}

async function resolveMiddlewareCandidates(projectRoot: string, srcDir: string | null): Promise<string[]> {
  const candidates = [
    'src/middleware.ts',
    'src/middleware.js',
    'middleware.ts',          // Next.js middleware at root
    'middleware.js',
    'src/app.ts',             // Express app entry
    'src/app.js',
    'src/server.ts',
    'src/server.js',
    'src/index.ts',
    'src/index.js',
  ]

  const found: string[] = []
  for (const candidate of candidates) {
    if (await exists(path.join(projectRoot, candidate))) {
      found.push(candidate)
    }
  }
  return found
}
