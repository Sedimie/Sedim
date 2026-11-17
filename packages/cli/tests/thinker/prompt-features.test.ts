import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DetectedContext, ModuleManifest } from '../../src/planning/types'
import { getAllManifestFeatures, promptModuleFeatures } from '../../src/thinker/prompt-features'
import * as ui from '../../src/showbaby/index'

vi.mock('../../src/showbaby/index', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/showbaby/index')>()
  return {
    ...actual,
    select: vi.fn(),
    multiselect: vi.fn(),
  }
})

describe('Generic feature selection (prompt-features)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  const mockContext: DetectedContext = {
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

  describe('getAllManifestFeatures', () => {
    it('generically extracts all declared features across arbitrary categories', () => {
      const manifest = {
        name: 'billing',
        version: '0.1.0',
        features: {
          gateways: ['stripe', 'lemonsqueezy'],
          models: ['subscription', 'usage-based'],
          currencies: ['usd', 'eur'],
        },
      } as unknown as ModuleManifest

      const all = getAllManifestFeatures(manifest)
      expect(all).toEqual(['stripe', 'lemonsqueezy', 'subscription', 'usage-based', 'usd', 'eur'])
    })

    it('includes sub-prompt options defined in featureMeta', () => {
      const manifest = {
        name: 'auth',
        version: '0.2.0',
        features: {
          ui: ['headless', 'tailwind', 'themed'],
        },
        featureMeta: {
          ui: {
            prompt: 'Choose UI',
            type: 'select',
            options: {
              headless: { label: 'Headless' },
              tailwind: { label: 'Tailwind' },
              themed: { label: 'Themed' },
            },
            subPrompts: {
              themed: {
                prompt: 'Choose theme',
                options: {
                  modern: { label: 'Modern' },
                  minimal: { label: 'Minimal' },
                },
              },
            },
          },
        },
      } as unknown as ModuleManifest

      const all = getAllManifestFeatures(manifest)
      expect(all).toContain('headless')
      expect(all).toContain('themed')
      expect(all).toContain('modern')
      expect(all).toContain('minimal')
    })
  })

  describe('promptModuleFeatures with featureMeta', () => {
    it('prompts using manifest featureMeta and handles subPrompts', async () => {
      const manifest = {
        name: 'auth',
        version: '0.2.0',
        features: {
          providers: ['email-password', 'totp'],
          ui: ['headless', 'themed'],
          authorization: ['rbac'],
        },
        featureMeta: {
          providers: {
            prompt: 'Which auth providers?',
            type: 'multiselect',
            options: {
              'email-password': { label: 'Email + Password', hint: 'credential' },
              totp: { label: 'TOTP', hint: '2FA' },
            },
          },
          ui: {
            prompt: 'UI style for auth components?',
            type: 'select',
            options: {
              headless: { label: 'Headless' },
              themed: { label: 'Themed' },
            },
            subPrompts: {
              themed: {
                prompt: 'Which theme variant?',
                options: {
                  modern: { label: 'Modern' },
                },
              },
            },
          },
          authorization: {
            prompt: 'Authorization model?',
            type: 'select',
            allowNone: true,
            options: {
              rbac: { label: 'RBAC' },
            },
          },
        },
      } as unknown as ModuleManifest

      vi.mocked(ui.multiselect).mockResolvedValueOnce(['email-password', 'totp'])
      vi.mocked(ui.select)
        .mockResolvedValueOnce('themed') // ui style
        .mockResolvedValueOnce('modern') // theme variant sub-prompt
        .mockResolvedValueOnce('none') // authorization skipped

      const selected = await promptModuleFeatures(manifest, mockContext)

      expect(ui.multiselect).toHaveBeenCalledWith(
        'Which auth providers?',
        expect.arrayContaining([
          expect.objectContaining({ value: 'email-password', label: 'Email + Password' }),
        ]),
      )

      expect(selected).toEqual(['email-password', 'totp', 'themed', 'modern'])
      expect(selected).not.toContain('none')
    })
  })

  describe('promptModuleFeatures without featureMeta (arbitrary modules)', () => {
    it('dynamically generates prompts for arbitrary modules without hardcoded CLI logic', async () => {
      const chatManifest = {
        name: 'chat',
        version: '0.1.0',
        features: {
          transports: ['websocket', 'sse'],
          storage_adapters: ['redis', 'postgres'],
        },
      } as unknown as ModuleManifest

      vi.mocked(ui.multiselect)
        .mockResolvedValueOnce(['websocket'])
        .mockResolvedValueOnce(['redis'])

      const selected = await promptModuleFeatures(chatManifest, mockContext)

      expect(ui.multiselect).toHaveBeenCalledTimes(2)
      expect(selected).toEqual(['websocket', 'redis'])
    })
  })
})
