import path from 'node:path'
import fs from 'fs-extra'
import * as ui from '../showbaby/index'
import { WorkspaceRootError } from './errors'
import { findProjectRoot } from './fs'

export async function ensureProjectRoot(from?: string): Promise<string> {
  try {
    return await findProjectRoot(from)
  } catch (err) {
    if (err instanceof WorkspaceRootError) {
      ui.logSection('Workspace Detected')
      ui.logWarn(`You ran sedim from a workspace root (${err.workspaceRoot}).`)

      const apps = await getWorkspaceApps(err.workspaceRoot)
      if (apps.length === 0) {
        ui.showError(new Error('No applications found in this workspace to target.'))
        process.exit(1)
      }

      const selected = await ui.select(
        'Which application do you want to target?',
        apps.map(app => ({
          value: app.absPath,
          label: app.name,
          hint: app.relPath,
        })),
      )

      return selected
    }
    throw err
  }
}

async function getWorkspaceApps(
  root: string,
): Promise<Array<{ name: string; absPath: string; relPath: string }>> {
  const apps: Array<{ name: string; absPath: string; relPath: string }> = []

  // A simple heuristic for now: look inside apps/ and packages/
  // In a robust implementation, we would parse pnpm-workspace.yaml / package.json workspaces.
  const scanDirs = ['apps', 'packages']
  for (const dir of scanDirs) {
    const absDir = path.join(root, dir)
    if (await fs.pathExists(absDir)) {
      const entries = await fs.readdir(absDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pkgPath = path.join(absDir, entry.name, 'package.json')
          if (await fs.pathExists(pkgPath)) {
            const pkg = await fs.readJSON(pkgPath)
            apps.push({
              name: pkg.name || entry.name,
              absPath: path.join(absDir, entry.name),
              relPath: `${dir}/${entry.name}`,
            })
          }
        }
      }
    }
  }

  // Check root itself if it's considered an app but has workspace defined
  return apps
}
