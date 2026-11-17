import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isSedimInitialised, readSedimConfig } from '../../src/config/read-sedim-config'
import { DetectionError } from '../../src/shared/errors'
import { SEDIM_CONFIG_CACHE, SEDIM_CONFIG_FILE } from '../../src/shared/constants'

describe('readSedimConfig & isSedimInitialised', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sedim-test-read-config-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('detects when sedim is not initialised', async () => {
    const isInit = await isSedimInitialised(tmpDir)
    expect(isInit).toBe(false)
  })

  it('detects when sedim is initialised via sedim.config.ts existence', async () => {
    await fs.writeFile(path.join(tmpDir, SEDIM_CONFIG_FILE), 'export default {}')
    const isInit = await isSedimInitialised(tmpDir)
    expect(isInit).toBe(true)
  })

  it('reads config from .sedim/config.json cache', async () => {
    const cacheDir = path.join(tmpDir, path.dirname(SEDIM_CONFIG_CACHE))
    await fs.mkdir(cacheDir, { recursive: true })
    const sampleConfig = {
      framework: 'express',
      orm: 'prisma',
      db: 'postgres',
    }
    await fs.writeFile(
      path.join(tmpDir, SEDIM_CONFIG_CACHE),
      JSON.stringify(sampleConfig, null, 2),
    )

    const loaded = await readSedimConfig(tmpDir)
    expect(loaded.framework).toBe('express')
    expect(loaded.orm).toBe('prisma')
  })

  it('throws DetectionError if config cache is missing', async () => {
    await expect(readSedimConfig(tmpDir)).rejects.toThrow(DetectionError)
  })
})
