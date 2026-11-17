import { describe, expect, it } from 'vitest'
import type { DetectedContext } from '@sedim/core'
import { createAuthPlanConfig, resolveThemeVariant } from '../plan-config'

describe('Theme variant canonical resolution and plan-config', () => {
  describe('resolveThemeVariant', () => {
    it('resolves canonical theme names correctly', () => {
      expect(resolveThemeVariant(['modern'])).toBe('modern')
      expect(resolveThemeVariant(['minimal'])).toBe('minimal')
      expect(resolveThemeVariant(['colorful'])).toBe('colorful')
    })

    it('resolves design doc and legacy aliases correctly', () => {
      expect(resolveThemeVariant(['modern-elegant'])).toBe('modern')
      expect(resolveThemeVariant(['glass'])).toBe('modern')
      expect(resolveThemeVariant(['enterprise'])).toBe('modern')

      expect(resolveThemeVariant(['minimal-neumorph'])).toBe('minimal')
      expect(resolveThemeVariant(['neumorphic'])).toBe('minimal')

      expect(resolveThemeVariant(['neubrutalist'])).toBe('colorful')
      expect(resolveThemeVariant(['neubrutalism'])).toBe('colorful')
    })

    it('defaults to modern when no theme variant is specified or found', () => {
      expect(resolveThemeVariant([])).toBe('modern')
      expect(resolveThemeVariant(['email-password', 'totp'])).toBe('modern')
    })

    it('picks the first recognized theme variant from feature array', () => {
      expect(resolveThemeVariant(['email-password', 'minimal', 'modern'])).toBe('minimal')
      expect(resolveThemeVariant(['colorful', 'minimal'])).toBe('colorful')
    })
  })

  describe('createAuthPlanConfig theme stamping', () => {
    const mockContext: DetectedContext = {
      framework: { value: 'nextjs', confidence: 1, files: [] },
      orm: { value: 'drizzle', confidence: 1, files: [] },
      language: { value: 'typescript', confidence: 1, files: [] },
      packageManager: { value: 'pnpm', confidence: 1, files: [] },
      db: { value: 'postgres', confidence: 1, files: [] },
      structure: { srcDir: 'src', apiDir: 'src/app/api', pagesDir: 'src/app' },
    }

    it('stamps tokens.css with modern theme by default for themed ui', () => {
      const plan = createAuthPlanConfig(mockContext, ['email-password', 'ui:themed'])
      const tokenTemplate = plan.templates.find(t => t.outputPath().endsWith('tokens.css'))
      expect(tokenTemplate).toBeDefined()
      expect(tokenTemplate?.templateKey).toBe('auth/ui/themed/modern-tokens.css')
    })

    it('stamps tokens.css with minimal theme when minimal is selected', () => {
      const plan = createAuthPlanConfig(mockContext, ['email-password', 'ui:themed', 'minimal'])
      const tokenTemplate = plan.templates.find(t => t.outputPath().endsWith('tokens.css'))
      expect(tokenTemplate).toBeDefined()
      expect(tokenTemplate?.templateKey).toBe('auth/ui/themed/minimal-tokens.css')
    })

    it('stamps tokens.css with colorful theme when colorful is selected', () => {
      const plan = createAuthPlanConfig(mockContext, ['email-password', 'ui:themed', 'colorful'])
      const tokenTemplate = plan.templates.find(t => t.outputPath().endsWith('tokens.css'))
      expect(tokenTemplate).toBeDefined()
      expect(tokenTemplate?.templateKey).toBe('auth/ui/themed/colorful-tokens.css')
    })

    it('stamps tokens.css correctly when legacy or alias themes are selected', () => {
      const planLegacy = createAuthPlanConfig(mockContext, ['email-password', 'ui:themed', 'enterprise'])
      const tokenLegacy = planLegacy.templates.find(t => t.outputPath().endsWith('tokens.css'))
      expect(tokenLegacy?.templateKey).toBe('auth/ui/themed/modern-tokens.css')

      const planNeumorph = createAuthPlanConfig(mockContext, ['email-password', 'ui:themed', 'minimal-neumorph'])
      const tokenNeumorph = planNeumorph.templates.find(t => t.outputPath().endsWith('tokens.css'))
      expect(tokenNeumorph?.templateKey).toBe('auth/ui/themed/minimal-tokens.css')

      const planNeubrutalist = createAuthPlanConfig(mockContext, ['email-password', 'ui:themed', 'neubrutalist'])
      const tokenNeubrutalist = planNeubrutalist.templates.find(t => t.outputPath().endsWith('tokens.css'))
      expect(tokenNeubrutalist?.templateKey).toBe('auth/ui/themed/colorful-tokens.css')
    })
  })
})
