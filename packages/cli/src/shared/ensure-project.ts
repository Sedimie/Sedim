import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import * as ui from '../showbaby/index'
import { WorkspaceRootError } from './errors'
import { findProjectRoot } from './fs'

export async function ensureProjectRoot(from?: string): Promise<string> {
  try {
    const root = await findProjectRoot(from)

    // warn if the project appears empty or incomplete
    if (isEmptyProject(root)) {
      console.log()
      ui.logWarn('This directory appears mostly empty.')
      console.log(
        `  ${chalk.dim('Add a package.json and/or tsconfig.json, or create a src/ folder.')}`,
      )
      console.log(`  ${chalk.dim('Without these, sedim cannot detect your stack reliably.')}`)
      console.log()
    }

    return root
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

  // Scan apps/ and packages/ directories for valid workspace members
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

  return apps
}

// Check if the project root appears to be an empty/incomplete project
export function isEmptyProject(projectRoot: string): boolean {
  const markers = [
    'package.json',
    'tsconfig.json',
    'src/index.ts',
    'src/index.js',
    'index.ts',
    'index.js',
    'app',
    'src',
  ]

  let markerCount = 0
  for (const marker of markers) {
    if (fs.existsSync(path.join(projectRoot, marker))) markerCount++
  }

  // Empty if fewer than 2 markers exist
  return markerCount < 2
}
