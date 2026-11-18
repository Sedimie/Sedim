import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectFrontend } from '../../src/detector/detect-frontend'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fix = (name: string) => path.resolve(__dirname, '../../../../apps/playground', name)

describe('detectFrontend', () => {
  it('detects React + Vite companion app in frontend directory', async () => {
    const result = await detectFrontend(fix('express-react-companion'))
    expect(result).not.toBeNull()
    expect(result?.framework).toBe('react')
    expect(result?.buildTool).toBe('vite')
    expect(result?.relPath).toBe('frontend')
  })

  it('detects Vue + Vite companion app in frontend directory', async () => {
    const result = await detectFrontend(fix('express-vue-companion'))
    expect(result).not.toBeNull()
    expect(result?.framework).toBe('vue')
    expect(result?.buildTool).toBe('vite')
    expect(result?.relPath).toBe('frontend')
  })

  it('returns null when no frontend companion exists', async () => {
    const result = await detectFrontend(fix('empty'))
    expect(result).toBeNull()
  })
})
