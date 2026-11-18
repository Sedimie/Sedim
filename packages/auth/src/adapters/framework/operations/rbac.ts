import { requireRole, hasPermission, type Action, type Resource } from '../../../core/rbac.js'
import type { User } from '../../types.js'

// ── RBAC middleware factory ─────────────────────────────────────

/**
 * Creates a route guard that requires one of the given roles.
 *
 * Usage in a route handler:
 *   const user = c.var.user  // from session middleware
 *   const check = requirePermission(user, { roles: ['admin'] })
 *   if (!check.allowed) return c.json({ error: 'forbidden' }, 403)
 */
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
