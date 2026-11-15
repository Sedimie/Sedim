import { describe, expect, it } from 'vitest'
import { createAuthPlanConfig } from '../../../auth/src/plan-config.js'
import type { DetectedContext } from '../../src/planning/types.js'
import { resolveTemplate } from '../../src/thinker/resolve-template.js'

describe('split operations and feature-conditional stamping', () => {
  const mockCtx: DetectedContext = {
    projectRoot: '/test',
    packageJson: {},
    framework: { value: 'nextjs', confidence: 1 },
    orm: { value: 'drizzle', confidence: 1 },
    db: { value: 'postgres', confidence: 1 },
    language: 'ts',
    packageManager: 'pnpm',
    structure: { srcDir: 'src', routesDir: 'src/app' },
  }

  it('email-password-only stamp does not include rbac, abac, jwt, oidc, pkce, totp, or jose', () => {
    const plan = createAuthPlanConfig(mockCtx, ['email-password'])

    // dependencies must not pull jose or @oslojs/oauth2
    expect(plan.dependencies).not.toContain('jose')
    expect(plan.dependencies).not.toContain('@oslojs/oauth2')
    expect(plan.dependencies).toContain('argon2')
    expect(plan.dependencies).toContain('@oslojs/crypto')

    // template keys must not include unselected modules
    const templateKeys = plan.templates.map(t => t.templateKey)
    expect(templateKeys).not.toContain('auth/core/jwt')
    expect(templateKeys).not.toContain('auth/core/rbac')
    expect(templateKeys).not.toContain('auth/core/abac')
    expect(templateKeys).not.toContain('auth/core/oidc')
    expect(templateKeys).not.toContain('auth/core/pkce')
    expect(templateKeys).not.toContain('auth/core/totp')
    expect(templateKeys).not.toContain('auth/core/totp-crypto')

    // must include core operations and unified facade
    expect(templateKeys).toContain('auth/adapters/framework/operations/core')
    expect(templateKeys).toContain('auth/templates/operations')
  })

  it('stamps oauth operations and jose when oauth features are selected', () => {
    const plan = createAuthPlanConfig(mockCtx, ['email-password', 'oauth-google'])

    expect(plan.dependencies).toContain('jose')
    expect(plan.dependencies).toContain('@oslojs/oauth2')

    const templateKeys = plan.templates.map(t => t.templateKey)
    expect(templateKeys).toContain('auth/core/pkce')
    expect(templateKeys).toContain('auth/core/oidc')
    expect(templateKeys).toContain('auth/adapters/framework/operations/oauth')
  })

  it('stamps jwt operations and jose when jwt is selected', () => {
    const plan = createAuthPlanConfig(mockCtx, ['email-password', 'jwt'])

    expect(plan.dependencies).toContain('jose')

    const templateKeys = plan.templates.map(t => t.templateKey)
    expect(templateKeys).toContain('auth/core/jwt')
    expect(templateKeys).toContain('auth/adapters/framework/operations/jwt')
  })

  it('stamps totp operations and crypto when totp is selected', () => {
    const plan = createAuthPlanConfig(mockCtx, ['email-password', 'totp'])

    const templateKeys = plan.templates.map(t => t.templateKey)
    expect(templateKeys).toContain('auth/core/totp')
    expect(templateKeys).toContain('auth/core/totp-crypto')
    expect(templateKeys).toContain('auth/adapters/framework/operations/totp')
  })

  it('resolves operations template with safe stubs for email-password only', async () => {
    const content = await resolveTemplate('auth/templates/operations', mockCtx, ['email-password'])

    expect(content).toContain("export * from './operations/core'")
    expect(content).toContain('oauth-provider-unknown')
    expect(content).toContain('totp-not-enabled')
    expect(content).toContain('token-invalid')
    // Must not statically import from operations/jwt or operations/oauth
    expect(content).not.toContain("from './operations/jwt'")
    expect(content).not.toContain("from './operations/oauth'")
  })

  it('resolves operations template with real re-exports when oauth and jwt are selected', async () => {
    const content = await resolveTemplate('auth/templates/operations', mockCtx, [
      'email-password',
      'oauth-google',
      'jwt',
    ])

    expect(content).toContain("export { createOAuthRedirect, handleOAuthCallback } from './operations/oauth'")
    expect(content).toContain("export { refreshAccessToken, revokeRefreshToken } from './operations/jwt'")
  })
})
