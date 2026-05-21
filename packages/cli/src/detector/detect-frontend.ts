import path from 'node:path'
import type { DetectedFrontend } from '@sedim/core'
import fs from 'fs-extra'
import { exists, readJSON } from '../shared/fs'

// Common naming patterns for frontend companion apps in any project structure
const FRONTEND_DIR_PATTERNS = [
  'client',
  'frontend',
  'web',
  'app',
  'ui',
  'client-app',
  'frontend-app',
  'web-app',
  'apps/web',
  'apps/client',
  'apps/frontend',
  'src/client',
  'src/frontend',
  'src/web',
]

function isFrontendDir(name: string): boolean {
  return FRONTEND_DIR_PATTERNS.includes(name.toLowerCase())
}

async function detectInDir(projectRoot: string, dirName: string): Promise<DetectedFrontend | null> {
  const absDir = path.join(projectRoot, dirName)
  if (!(await exists(absDir))) return null

  const pkgPath = path.join(absDir, 'package.json')
  if (!(await exists(pkgPath))) return null

  const pkg = await readJSON<{
    name?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }>(pkgPath)

  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  if (deps['react'] && deps['vite']) {
    return {
      name: pkg.name || dirName,
      absPath: absDir,
      relPath: dirName,
      framework: 'react',
      buildTool: 'vite',
    }
  }

  if (deps['vue'] && deps['vite']) {
    return {
      name: pkg.name || dirName,
      absPath: absDir,
      relPath: dirName,
      framework: 'vue',
      buildTool: 'vite',
    }
  }

  if (deps['react'] && deps['next']) {
    // Next.js is its own full-stack framework — we don't treat it as a separate
    // frontend companion since the UI stamps directly into the Next.js project.
    // Only non-Next.js frontends (React/Vite, Vue/Vite) need this path.
    return null
  }

  return null
}

async function detectInWorkspace(projectRoot: string): Promise<DetectedFrontend | null> {
  // Monorepo: apps/<name> with react + vite
  const workspaceAppsDir = path.join(projectRoot, 'apps')
  if (await exists(workspaceAppsDir)) {
    const entries = await fs.readdir(workspaceAppsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const result = await detectInDir(projectRoot, path.join('apps', entry.name))
      if (result) return result
    }
  }
  return null
}

async function detectInSiblings(projectRoot: string): Promise<DetectedFrontend | null> {
  // Flat or non-monorepo: look for frontend-named dirs at project root level
  const parentDir = path.dirname(projectRoot)
  if (parentDir === projectRoot) return null // reached filesystem root

  const siblings = await fs.readdir(parentDir, { withFileTypes: true })
  for (const sibling of siblings) {
    if (!sibling.isDirectory()) continue
    if (!isFrontendDir(sibling.name)) continue
    if (sibling.name === path.basename(projectRoot)) continue // skip self

    const result = await detectInDir(parentDir, sibling.name)
    if (result) return result
  }
  return null
}

async function detectInSubdirs(projectRoot: string): Promise<DetectedFrontend | null> {
  // Search common frontend dir names within the project root
  for (const dirName of FRONTEND_DIR_PATTERNS) {
    const result = await detectInDir(projectRoot, dirName)
    if (result) return result
  }
  return null
}

// Main entry point — tries multiple strategies in order of reliability
export async function detectFrontend(projectRoot: string): Promise<DetectedFrontend | null> {
  // 1. Monorepo workspace apps/
  const fromWorkspace = await detectInWorkspace(projectRoot)
  if (fromWorkspace) return fromWorkspace

  // 2. Sibling directories (parent-level frontend/backend split)
  const fromSiblings = await detectInSiblings(projectRoot)
  if (fromSiblings) return fromSiblings

  // 3. Subdirectories of project root (client/, frontend/, web/ etc)
  const fromSubdirs = await detectInSubdirs(projectRoot)
  if (fromSubdirs) return fromSubdirs

  return null
}
