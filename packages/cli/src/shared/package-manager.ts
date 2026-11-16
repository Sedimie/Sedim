import fs from 'node:fs'
import path from 'node:path'
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
  dev = false,
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

  // npm is strict about peer deps by default — pass --legacy-peer-deps
  // to match the behaviour of pnpm/yarn which are more lenient
  const extraFlags: Record<PackageManager, string[]> = {
    npm: ['--legacy-peer-deps'],
    pnpm: [],
    bun: [],
    yarn: [],
  }

  const INSTALL_TIMEOUT_MS = 120000 // 2 minutes

  try {
    await execa(pm, [...args, ...extraFlags[pm]], {
      cwd: projectRoot,
      stdio: 'inherit',
      timeout: INSTALL_TIMEOUT_MS,
    })
  } catch (err: unknown) {
    const error = err as { timedOut?: boolean }
    if (error?.timedOut) {
      throw new WriteError(
        `Package installation timed out after ${INSTALL_TIMEOUT_MS / 1000}s while running: ${pm} ${args.join(' ')}`,
        err,
        `Check your network connection or npm registry status, or install manually: ${pm} ${args.join(' ')}`,
      )
    }
    throw new WriteError(
      `Failed to install packages: ${packages.join(', ')}`,
      err,
      `Try installing the packages manually: ${pm} ${args.join(' ')}`,
    )
  }
}
