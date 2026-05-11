import path from 'node:path'
import fs from 'fs-extra'
import { DetectionError, WriteError } from './errors'

export async function exists(filePath : string) : Promise<boolean> {
    return fs.pathExists(filePath);
}

export async function readText(filePath : string) : Promise<string> { 
    try {
        return await fs.readFile(filePath, 'utf-8');
    }catch(err){
        throw new WriteError(`Could not read file : ${filePath}`, err);
    }
}

export async function writeText(filePath : string, content : string): Promise<void> {
    try{
        return await fs.outputFile(filePath, content);
    }
    catch(err){
        throw new WriteError(`Could not write into file : ${filePath}`, err);
    }
}

export async function readJSON<T>(filePath : string): Promise<T>{
    try{
        return await fs.readJSON(filePath);
    }catch(err){
        throw new WriteError(`Couldn't read JSON from ${filePath}`, err);
    }
}

export async function writeJSON(filePath : string, data : unknown) : Promise<void>{
    try{
        fs.outputJSON(filePath, data, {spaces : 2});
    }catch(err){
        throw new WriteError(`Couldn't write JSON in ${filePath}`, err);
    }
}

// CAVEAT: if the user runs this from a monorepo workspace root, we throw with
// a helpful message asking them to run from inside their app directory.
// Automatically picking the right app from workspace packages is not handled —
// that requires user intent (a prompt in the init command). Tracked for Phase 0.4.
export async function findProjectRoot(from?: string): Promise<string> {
  let current = from ?? process.cwd()

  while (true) {
    // after first init: sedim.config.ts is the definitive marker
    if (await exists(path.join(current, 'sedim.config.ts'))) return current

    if (await exists(path.join(current, 'package.json'))) {
      // check if this is a workspace root — if so, it's not an app, keep walking up
      const isWorkspaceRoot = await _isWorkspaceRoot(current)
      if (!isWorkspaceRoot) return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      throw new DetectionError(
        `Could not find project root. Run this command from inside your app directory.`,
        undefined,
        `Try running from your app's root directory, not the monorepo root.`
      )
    }
    current = parent
  }
}

async function _isWorkspaceRoot(dir: string): Promise<boolean> {
  // pnpm workspaces
  if (await exists(path.join(dir, 'pnpm-workspace.yaml'))) return true

  // npm/yarn workspaces — check for "workspaces" field in package.json
  try {
    const pkg = await fs.readJSON(path.join(dir, 'package.json'))
    if (pkg.workspaces) return true
  } catch {
    // unreadable package.json — not a workspace root we can identify
  }

  return false
}