---
title: "Access Control: RBAC and ABAC Architecture"
description: Understanding authorization models, the role explosion problem in RBAC, and how Attribute-Based Access Control handles dynamic policies.
slug: auth/access-control
date: 2026-06-01
tags:
  - auth
  - rbac
  - abac
  - security
  - groundwork
---

## Authentication vs. Authorization

Before designing permissions, distinguish between two distinct security layers:

- **Authentication (AuthN)**: "Who are you?" (e.g., verifying a password, session token, or TOTP code).
- **Authorization (AuthZ)**: "What are you permitted to do?" (e.g., determining whether user 42 can delete document 108).

Once a user's identity is verified, access control mechanisms enforce business security boundaries across application routes, database queries, and background operations.

---

## Role-Based Access Control (RBAC)

**Role-Based Access Control (RBAC)** is the most common authorization paradigm. Users are assigned one or more named roles (such as `admin`, `editor`, `member`, or `viewer`), and permissions are assigned to those roles.

```
[ User ] ───────> [ Role: Editor ] ───────> [ Permission: articles:write ]
```

### Advantages of RBAC
- **Simplicity**: Intuitive mental model for administrators and developers.
- **Auditability**: Easy to inspect which users hold privileged roles.
- **Coarse-Grained Performance**: Checking `user.role === 'admin'` requires a single string comparison in route middleware.

### The Role Explosion Problem

RBAC functions well for coarse-grained boundaries, but rapidly breaks down as business rules introduce dynamic conditions:

> *"A user can edit an article if they are the original author, OR if they are an editor in the same department, but only if the article is in 'draft' status and the current time is during normal review hours."*

Attempting to model this purely with RBAC results in **role explosion**: you end up creating roles like `draft-author-finance`, `published-viewer-hr`, and `editor-same-dept`. Managing hundreds of hyperspecific static roles becomes unmaintainable and error-prone.

---

## Attribute-Based Access Control (ABAC)

**Attribute-Based Access Control (ABAC)** solves role explosion by evaluating policies against dynamic attributes rather than static role assignments.

Instead of asking *"Does the user have the `editor` role?"*, an ABAC engine evaluates an authorization request with four attribute dimensions:

1. **Subject Attributes**: Characteristics of the user making the request (e.g., `user.id`, `user.role`, `user.department`, `user.mfaVerified`).
2. **Resource Attributes**: Characteristics of the object being acted upon (e.g., `article.authorId`, `article.status`, `article.department`, `article.isLocked`).
3. **Action**: The operation being attempted (e.g., `read`, `edit`, `delete`, `publish`).
4. **Environment / Context Attributes**: The environmental circumstances of the request (e.g., `request.time`, `request.ip`, `request.location`).

### An ABAC Policy in Practice

```typescript
// Example ABAC Policy: Can Edit Article
const canEditArticlePolicy: AbacPolicy = {
  name: 'edit-article-rule',
  effect: 'allow',
  evaluate: (ctx) => {
    // Admins can always edit
    if (ctx.subject.role === 'admin') return true;

    // Authors can edit their own draft articles
    if (ctx.subject.id === ctx.resource.authorId && ctx.resource.status === 'draft') {
      return true;
    }

    // Department editors can edit if department matches
    if (ctx.subject.role === 'editor' && ctx.subject.department === ctx.resource.department) {
      return true;
    }

    return false;
  }
};
```

---

## Combining RBAC and ABAC in Production

Modern production systems do not treat RBAC and ABAC as mutually exclusive. They employ a **hybrid layered approach**:

```
[ Incoming Request ]
        │
        ▼ (Layer 1: Coarse-Grained RBAC Middleware)
   Is user at least an 'authenticated member'?
        │ Yes
        ▼ (Layer 2: Fine-Grained ABAC Policy)
   Does user own this resource OR have departmental permission under current state?
        │ Yes
[ Execute Operation ]
```

1. **Edge / Routing Layer (RBAC)**: Fast, non-database checks in HTTP middleware to block unprivileged requests before hitting compute resources (e.g., only `admin` can access `/admin/*`).
2. **Service / Domain Layer (ABAC)**: Contextual checks inside service handlers that inspect database row attributes and relationship graphs before mutating state.

---

## Core Security Rules for Access Control

- **Default Deny**: If no policy explicitly grants access, the engine must evaluate to `deny`.
- **Explicit Deny Overrides**: A single explicit `deny` policy must always take precedence over any number of matching `allow` policies.
- **Fail Secure**: Any runtime exception during policy evaluation (such as a missing attribute or database timeout) must reject the request immediately.

---

Now use it: `sedim add auth`
