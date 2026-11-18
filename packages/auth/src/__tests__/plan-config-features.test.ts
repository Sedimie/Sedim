import { describe, expect, it } from 'vitest'
import { createAuthPlanConfig } from '../plan-config.js'
import type { DetectedContext } from '../../../../packages/cli/src/planning/types.js'

function makeCtx(overrides: Partial<DetectedContext> = {}): DetectedContext {
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
    ...overrides,
  }
}

describe('createAuthPlanConfig - selective feature stamping (#11)', () => {
  it('stamps only core operations and no jose for email-password only', () => {
    const config = createAuthPlanConfig(makeCtx(), ['email-password'])
    const templateKeys = config.templates.map(t => t.templateKey)

    // Core templates present
    expect(templateKeys).toContain('auth/core/hash-password')
    expect(templateKeys).toContain('auth/core/generate-token')
    expect(templateKeys).toContain('auth/core/session')
    expect(templateKeys).toContain('auth/adapters/framework/operations/core')
    expect(templateKeys).toContain('auth/adapters/framework/operations')

    // Unselected features NOT present
    expect(templateKeys).not.toContain('auth/core/jwt')
    expect(templateKeys).not.toContain('auth/core/rbac')
    expect(templateKeys).not.toContain('auth/core/abac')
    expect(templateKeys).not.toContain('auth/core/oidc')
    expect(templateKeys).not.toContain('auth/core/pkce')
    expect(templateKeys).not.toContain('auth/core/totp')
    expect(templateKeys).not.toContain('auth/core/totp-crypto')
    expect(templateKeys).not.toContain('auth/adapters/framework/operations/jwt')
    expect(templateKeys).not.toContain('auth/adapters/framework/operations/totp')
    expect(templateKeys).not.toContain('auth/adapters/framework/operations/oauth')
    expect(templateKeys).not.toContain('auth/adapters/framework/operations/rbac')
    expect(templateKeys).not.toContain('auth/adapters/framework/operations/abac')
    expect(templateKeys).not.toContain('auth/adapters/framework/operations/magic-link')

    // jose is NOT in dependencies
    expect(config.dependencies).not.toContain('jose')
    expect(config.dependencies).toContain('argon2')
    expect(config.dependencies).toContain('@oslojs/crypto')
    expect(config.dependencies).toContain('@oslojs/encoding')
  })

  it('includes jwt operations and jose only when jwt feature is selected', () => {
    const config = createAuthPlanConfig(makeCtx(), ['email-password', 'jwt'])
    const templateKeys = config.templates.map(t => t.templateKey)

    expect(templateKeys).toContain('auth/core/jwt')
    expect(templateKeys).toContain('auth/adapters/framework/operations/jwt')
    expect(config.dependencies).toContain('jose')

    // Still does not include totp, rbac, abac, oauth
    expect(templateKeys).not.toContain('auth/core/totp')
    expect(templateKeys).not.toContain('auth/core/rbac')
    expect(templateKeys).not.toContain('auth/core/abac')
    expect(templateKeys).not.toContain('auth/core/oidc')
  })

  it('includes totp operations and crypto only when totp feature is selected', () => {
    const config = createAuthPlanConfig(makeCtx(), ['email-password', 'totp'])
    const templateKeys = config.templates.map(t => t.templateKey)

    expect(templateKeys).toContain('auth/core/totp')
    expect(templateKeys).toContain('auth/core/totp-crypto')
    expect(templateKeys).toContain('auth/adapters/framework/operations/totp')

    // jose is not needed for totp alone
    expect(config.dependencies).not.toContain('jose')
    expect(templateKeys).not.toContain('auth/core/jwt')
  })

  it('includes pkce, oidc, oauth operations and @oslojs/oauth2 when oauth is selected', () => {
    const config = createAuthPlanConfig(makeCtx(), ['email-password', 'oauth-google'])
    const templateKeys = config.templates.map(t => t.templateKey)

    expect(templateKeys).toContain('auth/core/pkce')
    expect(templateKeys).toContain('auth/core/oidc')
    expect(templateKeys).toContain('auth/adapters/framework/operations/oauth')
    expect(config.dependencies).toContain('jose')
    expect(config.dependencies).toContain('@oslojs/oauth2')
  })

  it('includes rbac and abac operations only when selected', () => {
    const config = createAuthPlanConfig(makeCtx(), ['email-password', 'rbac', 'abac'])
    const templateKeys = config.templates.map(t => t.templateKey)

    expect(templateKeys).toContain('auth/core/rbac')
    expect(templateKeys).toContain('auth/core/abac')
    expect(templateKeys).toContain('auth/adapters/framework/operations/rbac')
    expect(templateKeys).toContain('auth/adapters/framework/operations/abac')
    expect(config.dependencies).not.toContain('jose')
  })

  it('includes magic-link operations and email-transport when magic-link is selected', () => {
    const config = createAuthPlanConfig(makeCtx(), ['magic-link'])
    const templateKeys = config.templates.map(t => t.templateKey)

    expect(templateKeys).toContain('auth/core/email-transport')
    expect(templateKeys).toContain('auth/adapters/framework/operations/magic-link')
    expect(config.dependencies).toContain('nodemailer')
    expect(config.devDependencies).toContain('@types/nodemailer')
  })
})
