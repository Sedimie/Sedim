// src/sedim/auth/core/rbac.ts
// ── Role-Based Access Control ───────────────────────────────────
// Lightweight RBAC built on top of the existing session model.
// No separate roles table — roles live on the User type as a field.
//
// Design decisions:
//   - Roles are stored on the user record (no join tables for simple cases)
//   - Permissions are action + resource pairs: "create:post", "read:user", "delete:*"
//   - Roles are additive: a user with "admin" role has all permissions it declares
//   - Wildcard "*" means "all resources" for a given action
//   - RBAC is always checked server-side; roles are never trusted from the client
//
// Usage:
//   import { requireRole, requirePermission, hasPermission } from './core/rbac'
//
//   // Route guard — redirects or throws if not authorized
//   if (!requireRole(user, 'admin')) return Response.json({ error: 'forbidden' }, { status: 403 })
//
//   // Within a handler — returns boolean, no side effects
//   if (!hasPermission(user, 'delete', 'post')) return Response.json({ error: 'forbidden' }, { status: 403 })

import type { User } from '../adapters/types.js'

// ── Types ───────────────────────────────────────────────────────

export type Action = 'create' | 'read' | 'update' | 'delete' | '*'
export type Resource = string | '*'

export interface Permission {
  action: Action
  resource: Resource
}

export interface RoleDefinition {
  description: string
  permissions: Permission[]
}

// Well-known roles — extend this map to add custom roles.
// Keys are the role strings stored on the User record.
export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  user: {
    description: 'Default user — can manage their own resources.',
    permissions: [
      { action: 'read', resource: '*' },          // everyone can read public content
      { action: 'update', resource: 'own' },      // can update own profile
      { action: 'delete', resource: 'own' },     // can delete own account
    ],
  },
  admin: {
    description: 'Full admin — can manage all resources and users.',
    permissions: [
      { action: '*', resource: '*' },
    ],
  },
  moderator: {
    description: 'Can read and moderate content, but cannot manage users.',
    permissions: [
      { action: 'read', resource: '*' },
      { action: 'delete', resource: '*' },
    ],
  },
}

// ── Core check ─────────────────────────────────────────────────

/**
 * Returns true if the user has the given permission.
 * Wildcard roles grant all permissions.
 */
export function hasPermission(
  user: User,
  action: Action,
  resource: Resource,
): boolean {
  const role = (user as any)['role'] as string | undefined ?? 'user'
  const def = ROLE_DEFINITIONS[role]

  if (!def) return false

  for (const perm of def.permissions) {
    // wildcard action matches any action
    if (perm.action === '*' || perm.action === action) {
      // wildcard resource matches any resource
      if (perm.resource === '*' || perm.resource === resource) {
        return true
      }
      // 'own' means resource matches user.id
      if (perm.resource === 'own' && typeof resource === 'string' && resource.startsWith('user:')) {
        const targetUserId = resource.slice(5)
        if (targetUserId === user.id) return true
      }
    }
  }

  return false
}

/**
 * Throws if the user doesn't have the required role.
 * Use in route handlers: if (!requireRole(user, 'admin')) ...
 */
export function requireRole(user: User, ...roles: string[]): boolean {
  const userRole = (user as any)['role'] as string | undefined ?? 'user'
  return roles.includes(userRole)
}

/**
 * Returns true if the user has all of the given permissions.
 * Use for compound checks: hasPermissions(user, [{ action: 'read', resource: 'post' }])
 */
export function hasPermissions(user: User, checks: Permission[]): boolean {
  return checks.every(c => hasPermission(user, c.action, c.resource))
}

/**
 * Check if user's role is the same as or higher than targetRole.
 * Useful for "admin-or-moderator" checks without listing all roles.
 */
export function hasMinimumRole(user: User, targetRole: string): boolean {
  const roleHierarchy = ['user', 'moderator', 'admin']
  const userRole = (user as any)['role'] as string | undefined ?? 'user'
  const userIdx = roleHierarchy.indexOf(userRole)
  const targetIdx = roleHierarchy.indexOf(targetRole)
  if (userIdx < 0 || targetIdx < 0) return false
  return userIdx >= targetIdx
}