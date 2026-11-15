import { requireRole, hasPermission, type Action, type Resource } from '../../../core/rbac.js'
import {
  evaluateAbac,
  type AbacResult,
  type AbacPolicy,
  type AbacContext,
  type SubjectAttributes,
  type ResourceAttributes,
} from '../../../core/abac.js'
import type { User } from '../../types.js'

// ── RBAC route guard ──────────────────────────────────────────

export function requirePermission(
  user: User,
  opts: { roles?: string[]; action?: Action; resource?: Resource },
): { allowed: boolean } {
  if (!user) return { allowed: false }
  if (opts.roles?.length) {
    if (!requireRole(user, ...opts.roles)) return { allowed: false }
  }
  if (opts.action && opts.resource) {
    if (!hasPermission(user, opts.action, opts.resource)) return { allowed: false }
  }
  return { allowed: true }
}

// ── ABAC route guard ──────────────────────────────────────────

export function requireAbac(
  user: User,
  subjectAttrs: SubjectAttributes,
  resourceAttrs: ResourceAttributes,
  action: string,
  policies: AbacPolicy[],
  context?: AbacContext,
): AbacResult {
  if (!user) return { allowed: false, reason: 'no-user' }
  return evaluateAbac(
    policies,
    { ...subjectAttrs, role: (user as any)['role'] ?? 'user' },
    resourceAttrs,
    action,
    context,
  )
}
