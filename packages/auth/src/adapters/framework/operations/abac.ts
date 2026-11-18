import { evaluateAbac, type AbacResult, type AbacPolicy, type AbacContext, type SubjectAttributes, type ResourceAttributes } from '../../../core/abac.js'
import type { User } from '../../types.js'

// ── ABAC middleware factory ───────────────────────────────────────

/**
 * Creates a route guard that evaluates ABAC policies.
 *
 * Usage in a route handler:
 *   const check = requireAbac(user, { role: 'admin' }, { type: 'post' }, 'delete')
 *   if (!check.allowed) return c.json({ error: 'forbidden' }, 403)
 */
export function requireAbac(
  user: User,
  subjectAttrs: SubjectAttributes,
  resourceAttrs: ResourceAttributes,
  action: string,
  policies: AbacPolicy[],
  context?: AbacContext,
): AbacResult {
  if (!user) return { allowed: false, reason: 'no-user' }
  return evaluateAbac(policies, { ...subjectAttrs, role: (user as any)['role'] ?? 'user' }, resourceAttrs, action, context)
}
