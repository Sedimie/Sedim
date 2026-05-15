import path from 'node:path'
import type { SedimConfig } from '../planning/types'
import { SEDIM_CONFIG_CACHE, SEDIM_CONFIG_FILE } from '../shared/constants'
import { DetectionError } from '../shared/errors'
import { exists, readJSON } from '../shared/fs'

export async function readSedimConfig(projectRoot: string): Promise<SedimConfig> {
  // fast path — read the JSON cache written by init
  const cachePath = path.join(projectRoot, SEDIM_CONFIG_CACHE)
  if (await exists(cachePath)) {
    try {
      return await readJSON<SedimConfig>(cachePath)
    } catch {
      /* cache corrupt, fall through */
    }
  }

  throw new DetectionError(
    `sedim.config.ts not found. Have you run sedim init?`,
    undefined,
    `Run \`sedim init\` to set up sedim in this project.`,
  )
}

export async function isSedimInitialised(projectRoot: string): Promise<boolean> {
  return exists(path.join(projectRoot, SEDIM_CONFIG_FILE))
}
