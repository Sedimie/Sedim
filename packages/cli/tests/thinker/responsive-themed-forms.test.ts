import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveTemplate } from '../../src/thinker/resolve-template'
import type { DetectedContext } from '../../src/planning/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../../../')

function makeMockCtx(): DetectedContext {
  return {
    projectRoot: '/test',
    packageManager: 'pnpm',
    language: { value: 'typescript', confidence: 'high', evidence: [] },
    moduleSystem: { value: 'esm', confidence: 'high', evidence: [] },
    framework: { value: 'nextjs', confidence: 'high', evidence: [] },
    orm: { value: 'drizzle', confidence: 'high', evidence: [] },
    db: { value: 'postgres', confidence: 'high', evidence: [] },
    structure: { srcDir: 'src', routeEntrypoints: [], middlewareCandidates: [] },
    schema: { tables: [], probableUserTable: null, authSignals: [], existingAuthDetected: false },
    codeArchitecture: {
      routerStyle: 'file-based',
      layoutStyle: 'app-router',
      appEntrypoint: null,
      apiDir: 'src/app/api',
      providersFile: null,
      hasBarrelExports: false,
      importStyle: 'named',
      injectionAnchors: {},
    },
    runtime: { nodeVersion: null },
    conflicts: { level: 'none', existingAuthDetected: false, signals: [] },
  }
}

describe('Themed auth forms responsive breakpoints and overflow handling (#24)', () => {
  it('generates responsive split layout for modern theme without rigid inline flex: 0 0 480px', async () => {
    const ctx = makeMockCtx()
    const content = await resolveTemplate('auth/ui/pages/login-page', ctx, ['themed', 'modern', 'email-password'])

    expect(content).toContain('sedim-auth-page sedim-auth-split-layout')
    expect(content).toContain('sedim-auth-panel')
    expect(content).toContain('sedim-auth-decorative')

    // Ensure rigid inline styles that caused horizontal overflow on mobile are removed
    expect(content).not.toContain("flex: '0 0 480px'")
  })

  it('generates responsive layout for minimal and colorful themes with overflow protection', async () => {
    const ctx = makeMockCtx()
    const minimalContent = await resolveTemplate('auth/ui/pages/login-page', ctx, ['themed', 'minimal', 'email-password'])
    expect(minimalContent).toContain('minHeight: \'100vh\'')
    expect(minimalContent).toContain('boxSizing: \'border-box\'')

    const colorfulContent = await resolveTemplate('auth/ui/pages/login-page', ctx, ['themed', 'colorful', 'email-password'])
    expect(colorfulContent).toContain('minHeight: \'100vh\'')
    expect(colorfulContent).toContain('boxSizing: \'border-box\'')
  })

  it('generates responsive signup, forgot-password, and reset-password pages', async () => {
    const ctx = makeMockCtx()
    const signup = await resolveTemplate('auth/ui/pages/signup-page', ctx, ['themed', 'modern', 'email-password'])
    expect(signup).toContain('sedim-auth-page sedim-auth-split-layout')
    expect(signup).toContain('sedim-auth-panel')
    expect(signup).not.toContain("flex: '0 0 480px'")

    const forgot = await resolveTemplate('auth/ui/pages/forgot-password-page', ctx, ['themed', 'minimal', 'email-password'])
    expect(forgot).toContain('boxSizing: \'border-box\'')

    const reset = await resolveTemplate('auth/ui/pages/reset-password-page', ctx, ['themed', 'minimal', 'email-password'])
    expect(reset).toContain('boxSizing: \'border-box\'')
  })

  it('all theme token CSS files contain responsive breakpoints and overflow prevention', () => {
    const tokenFiles = ['minimal-tokens.css', 'modern-tokens.css', 'colorful-tokens.css']

    for (const file of tokenFiles) {
      const filePath = path.join(rootDir, 'packages/auth/src/ui/themed', file)
      const css = fs.readFileSync(filePath, 'utf-8')

      // Check overflow prevention rules
      expect(css).toContain('overflow-x: hidden')
      expect(css).toContain('box-sizing: border-box')

      // Check responsive breakpoints
      expect(css).toContain('@media (max-width: 900px)')
      expect(css).toContain('@media (max-width: 640px)')
      expect(css).toContain('@media (max-width: 380px)')

      // Check split layout classes
      expect(css).toContain('.sedim-auth-split-layout')
      expect(css).toContain('.sedim-auth-panel')
      expect(css).toContain('.sedim-auth-decorative')
    }
  })
})
