import path from 'node:path'
import fs from 'node:fs'
import { execa } from 'execa'
import type { PackageManager } from '../planning/types'
import { WriteError } from './errors'

export function detectPackageManager(projectRoot: string): PackageManager {
  const has = (file: string) => fs.existsSync(path.join(projectRoot, file))

  if (has('pnpm-lock.yaml')) return 'pnpm'
  if (has('bun.lockb')) return 'bun'
  if (has('yarn.lock')) return 'yarn'
  return 'npm'
}

export async function installDependencies(
  packages: string[],
  projectRoot: string,
  dev = false
): Promise<void> {
  const pm = detectPackageManager(projectRoot)

  // each PM uses a slightly different dev flag
  const devFlags: Record<PackageManager, string> = {
    pnpm: '-D',
    bun: '-d',
    yarn: '--dev',
    npm: '--save-dev',
  }

  const args = ['add', ...packages]
  if (dev) args.push(devFlags[pm])

  try {
    await execa(pm, args, { cwd: projectRoot, stdio: 'inherit' })
  } catch (err) {
    throw new WriteError(`Failed to install packages: ${packages.join(', ')}`, err)
  }
}
