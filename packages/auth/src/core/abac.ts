// src/sedim/auth/core/abac.ts
// ── Attribute-Based Access Control ──────────────────────────────
// ABAC makes access decisions based on arbitrary attributes of the
// subject (user), resource, and environment — more flexible than RBAC.
//
// Unlike RBAC (which is role-centric), ABAC evaluates policies against
// attribute bundles. Policies are stored as JSON and evaluated in-memory.
//
// Design:
//   - Policies are simple rules: { subject: {...}, resource: {...}, effect: 'allow' | 'deny' }
//   - Attributes come from the user record, resource context, and environment
//   - First matching effect wins (deny takes priority by default)
//   - Policies are loaded from the auth config at startup
//
// Example policy:
//   {
//     "effect": "allow",
//     "subject": { "role": "admin" },
//     "resource": { "type": "post" },
//     "action": "delete"
//   }
//
// Usage in a route handler:
//   const result = evaluateAbac(user, { type: 'post', ownerId: post.userId }, 'delete', context)
//   if (!result.allowed) return Response.json({ error: 'forbidden' }, { status: 403 })

import type { User } from '../adapters/types.js'

// ── Types ───────────────────────────────────────────────────────

export interface SubjectAttributes {
  role?: string
  email?: string
  emailVerified?: boolean
  [key: string]: unknown
}

export interface ResourceAttributes {
  type: string
  ownerId?: string
  visibility?: 'public' | 'private' | 'internal'
  [key: string]: unknown
}

export interface EnvironmentAttributes {
  ip?: string
  timestamp?: Date
  [key: string]: unknown
}

export type Action = string | '*'

export interface AbacPolicy {
  id: string
  description: string
  effect: 'allow' | 'deny'
  subject?: Partial<SubjectAttributes>
  resource?: Partial<ResourceAttributes>
  action?: Action
  environment?: Partial<EnvironmentAttributes>
  /** JSONata-like condition — evaluated as a simple expression */
  condition?: string
}

export interface AbacContext {
  environment?: EnvironmentAttributes
}

export interface AbacResult {
  allowed: boolean
  reason?: string
  matchedPolicy?: AbacPolicy
}

// ── Policy evaluation ────────────────────────────────────────────

function matchAttributes(pattern: Record<string, unknown>, actual: Record<string, unknown>): boolean {
  for (const key of Object.keys(pattern)) {
    const pv = pattern[key]
    const av = actual[key]
    if (pv === '*') continue
    if (pv === undefined) continue
    if (pv !== av) return false
  }
  return true
}

function matchAction(pattern: Action, actual: string): boolean {
  if (pattern === '*') return true
  return pattern === actual
}

/**
 * Evaluate a list of ABAC policies against the given attributes.
 * Returns the result of the first matching policy (by order in the list).
 * If no policy matches, returns { allowed: false, reason: 'no-matching-policy' }.
 *
 * Deny policies are NOT auto-evaluated — callers should explicitly include
 * deny policies in the policy list if they want deny-first semantics.
 */
export function evaluateAbac(
  policies: AbacPolicy[],
  subject: SubjectAttributes,
  resource: ResourceAttributes,
  action: string,
  context: AbacContext = {},
): AbacResult {
  const env = context.environment ?? {}

  for (const policy of policies) {
    let matched = true

    if (policy.subject && !matchAttributes(policy.subject, subject)) matched = false
    if (matched && policy.resource && !matchAttributes(policy.resource, resource)) matched = false
    if (matched && policy.action && !matchAction(policy.action, action)) matched = false
    if (matched && policy.environment && !matchAttributes(policy.environment, env)) matched = false

    if (matched) {
      return {
        allowed: policy.effect === 'allow',
        reason: policy.description,
        matchedPolicy: policy,
      }
    }
  }

  return { allowed: false, reason: 'no-matching-policy' }
}

// ── Default policies ─────────────────────────────────────────────

/**
 * Default policies that apply to every auth context.
 * Extend this array by passing your own policies to evaluateAbac().
 */
export const DEFAULT_ABAC_POLICIES: AbacPolicy[] = [
  {
    id: 'deny-unverified-email',
    description: 'Deny email-related actions for unverified email addresses',
    effect: 'deny',
    subject: { emailVerified: false },
    resource: { type: 'email-action' },
    action: '*',
  },
  {
    id: 'allow-admin-all',
    description: 'Admins can do anything',
    effect: 'allow',
    subject: { role: 'admin' },
    resource: { type: '*' },
    action: '*',
  },
  {
    id: 'allow-own-resource',
    description: 'Users can manage their own resources',
    effect: 'allow',
    subject: { role: 'user' },
    resource: { ownerId: '{{ subject.id }}' },
    action: '*',
  },
]

/**
 * Evaluate with default policies appended after custom ones.
 * Custom policies take priority — they are evaluated first.
 */
export function evaluateAbacWithDefaults(
  customPolicies: AbacPolicy[],
  subject: SubjectAttributes,
  resource: ResourceAttributes,
  action: string,
  context: AbacContext = {},
): AbacResult {
  return evaluateAbac([...customPolicies, ...DEFAULT_ABAC_POLICIES], subject, resource, action, context)
}

// ── Builder helper ──────────────────────────────────────────────

/**
 * Build a policy programmatically — useful for programmatic policy creation.
 */
export function buildPolicy(p: Omit<AbacPolicy, 'id' | 'description'> & { id?: string; description?: string }): AbacPolicy {
  const policy: AbacPolicy = {
    id: p.id ?? crypto.randomUUID(),
    description: p.description ?? '',
    effect: p.effect,
  }
  if (p.subject !== undefined) policy.subject = p.subject
  if (p.resource !== undefined) policy.resource = p.resource
  if (p.action !== undefined) policy.action = p.action
  if (p.environment !== undefined) policy.environment = p.environment
  if (p.condition !== undefined) policy.condition = p.condition
  return policy
}