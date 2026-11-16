import { describe, expect, it } from 'vitest'
import type { ModuleManifest } from '../../src/planning/types.js'

describe('generic manifest-driven feature prompts and flattening', () => {
  it('flattens arbitrary manifest categories without hardcoded keys', () => {
    const billingManifest: ModuleManifest = {
      name: 'billing',
      version: '0.1.0',
      layers: {
        protocol: [],
        logic: [],
        persistence: { tables: [], requires: [] },
        contract: { types: '' },
        adapter: { frameworks: ['nextjs'], orms: ['drizzle'] },
        delivery: { stamps: [] },
        ui: { headless: true, tailwind: false, themes: [] },
      },
      features: {
        gateways: ['stripe', 'lemon-squeezy', 'paddle'],
        models: ['subscription', 'one-time'],
        webhooks: ['customer-created', 'invoice-paid'],
      },
      requires: { envVars: [], peerModules: [] },
      adapters: { frameworks: ['nextjs'], orms: ['drizzle'] },
    }

    const allFeatures = Object.values(billingManifest.features)
      .filter((v): v is string[] => Array.isArray(v))
      .flat()

    expect(allFeatures).toContain('stripe')
    expect(allFeatures).toContain('lemon-squeezy')
    expect(allFeatures).toContain('paddle')
    expect(allFeatures).toContain('subscription')
    expect(allFeatures).toContain('one-time')
    expect(allFeatures).toContain('customer-created')
    expect(allFeatures).toContain('invoice-paid')
    expect(allFeatures).toHaveLength(7)
  })

  it('preserves all auth feature categories in generic flattening', () => {
    const authManifest: ModuleManifest = {
      name: 'auth',
      version: '0.2.0',
      layers: {
        protocol: [],
        logic: [],
        persistence: { tables: [], requires: [] },
        contract: { types: '' },
        adapter: { frameworks: ['nextjs'], orms: ['drizzle'] },
        delivery: { stamps: [] },
        ui: { headless: true, tailwind: true, themes: ['modern', 'minimal', 'colorful'] },
      },
      features: {
        providers: ['email-password', 'magic-link', 'oauth-google', 'totp'],
        authorization: ['rbac', 'abac'],
        session: ['session-cookie', 'jwt'],
        security: ['rate-limit', 'account-lockout'],
        ui: ['headless', 'tailwind', 'themed'],
      },
      requires: { envVars: [], peerModules: [] },
      adapters: { frameworks: ['nextjs'], orms: ['drizzle'] },
    }

    const allFeatures = Object.values(authManifest.features)
      .filter((v): v is string[] => Array.isArray(v))
      .flat()

    expect(allFeatures).toContain('email-password')
    expect(allFeatures).toContain('magic-link')
    expect(allFeatures).toContain('oauth-google')
    expect(allFeatures).toContain('totp')
    expect(allFeatures).toContain('rbac')
    expect(allFeatures).toContain('abac')
    expect(allFeatures).toContain('session-cookie')
    expect(allFeatures).toContain('jwt')
    expect(allFeatures).toContain('rate-limit')
    expect(allFeatures).toContain('account-lockout')
    expect(allFeatures).toContain('headless')
    expect(allFeatures).toContain('tailwind')
    expect(allFeatures).toContain('themed')
  })
})
