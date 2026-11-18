---
title: "RFC: Scoping the Second Stampable Module (Billing and Storage)"
description: Architectural evaluation and formal specification proposal for Sedim's second stampable module after Auth.
slug: modules/second-module-rfc
---

# RFC: Scoping the Second Stampable Module

- **Status:** Proposed
- **Discussion Context:** [Sedim 2026 Direction (Discussions #25)](https://github.com/orgs/Sedimie/discussions/25)
- **Target Issue:** Resolves [#33](https://github.com/Sedimie/Sedim/issues/33)
- **Author:** Sanjai Gopal (`@Sanjai-Gopal`)

---

## 1. Executive Summary

Sedim has proven its core value proposition with `@sedim/auth`: **giving developers production-grade capabilities as owned, editable, stack-adapted source code** rather than closed black-box libraries or brittle starter templates.

To demonstrate that Sedim is a **generic codegen engine** rather than an auth tool, the second module must:
1. Exercise the entire generic pipeline: detection, manifest parsing, persistence schema generation, framework route stamping, and AST injection.
2. Address universal boilerplate that every modern web application rebuilds.
3. Solve a real pain point where library lock-in creates technical debt.

This proposal evaluates the top three module candidates, selects **`@sedim/billing`** as the primary module (with **`@sedim/storage`** as the immediate companion), and defines the full architecture and manifest specification.

---

## 2. Evaluation of Candidate Modules

| Criteria | 1. Billing (`@sedim/billing`) | 2. Storage (`@sedim/storage`) | 3. Health (`@sedim/health`) |
| :--- | :--- | :--- | :--- |
| **Boilerplate Severity** | **Extreme** (Webhooks, subscriptions, customer sync, portal redirects) | High (Presigned URLs, multi-part uploads, MIME validation) | Low (Probes, uptime endpoints, DB ping) |
| **Pain with Existing Tools** | Closed SaaS wrappers create vendor lock-in; raw Stripe SDK requires 800+ lines of glue code. | AWS S3 SDK is cumbersome; wrappers obscure direct CDN / presigned URL patterns. | Trivial to write manually; lacks sufficient complexity to stress the engine. |
| **Stack Independence** | Must adapt to Drizzle/Prisma, Next.js/Express/Hono/Fastify, Postgres/MySQL/SQLite. | Independent of database ORMs; mostly framework & storage provider (S3/R2/GCS). | Mostly framework-only; does not test schema stamping or persistence migrations. |
| **Proves Generalization** | **High**: Tests schema tables (`customers`, `subscriptions`, `invoices`), raw body webhooks, and UI tiers. | Medium: Tests route handlers and client upload hooks. | Low: Minimal test of engine capabilities. |

### Decision: Primary Selection is `@sedim/billing`

`@sedim/billing` is the ultimate proof that Sedim's module-author contract works:
- It requires **database persistence** (customer mappings, subscription tiers, renewal dates).
- It requires **framework routes** with raw-body stream handling for cryptographic webhook verification (Stripe / LemonSqueezy).
- It requires **environment variable detection** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- It gives developers complete ownership of the billing webhook lifecycle without monthly SaaS fees.

---

## 3. Module Specification: `@sedim/billing`

### 3.1 Registry Manifest (`registry/billing/latest.json`)

```json
{
  "name": "billing",
  "version": "0.1.0",
  "layers": {
    "protocol": ["http-webhooks", "checkout-redirect", "customer-portal"],
    "logic": ["signature-verification", "subscription-state", "idempotency"],
    "persistence": {
      "tables": [
        "billing_customers",
        "billing_subscriptions",
        "billing_webhook_events"
      ],
      "requires": ["users"]
    },
    "contract": {
      "types": "./src/adapters/types.ts"
    },
    "adapter": {
      "frameworks": ["nextjs", "express", "hono", "fastify"],
      "orms": ["drizzle", "prisma"]
    },
    "delivery": {
      "stamps": ["schema", "config", "routes", "webhook-handler"]
    },
    "ui": {
      "headless": true,
      "tailwind": true,
      "themes": ["minimal", "modern", "colorful"]
    }
  },
  "features": {
    "providers": ["stripe", "lemonsqueezy"],
    "models": ["recurring-subscription", "usage-metered", "one-time-purchase"],
    "ui": ["pricing-table", "customer-portal-button", "subscription-badge"]
  },
  "requires": {
    "envVars": [
      "BILLING_PROVIDER",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET"
    ],
    "dependencies": [
      "stripe"
    ]
  }
}
```

### 3.2 What It Stamps Into Your Project

Running `sedim add billing` creates the following directory structure inside `src/sedim/billing/`:

```
src/sedim/billing/
├── config.ts                    - User-editable billing config (plans, prices, trial periods)
├── adapters/
│   ├── types.ts                 - Customer, Subscription, and Plan type definitions
│   ├── database/                - Drizzle or Prisma queries for subscriptions and customers
│   └── framework/               - Route handlers for checkout, customer portal, and webhooks
│       ├── nextjs.ts
│       ├── express.ts
│       ├── hono.ts
│       └── fastify.ts
├── core/
│   ├── webhooks.ts              - Cryptographic signature validation and idempotency deduplication
│   ├── checkout.ts              - Hosted checkout session generation
│   └── portal.ts                - Customer self-serve billing portal session generator
└── ui/
    ├── PricingTable.tsx         - Responsive plan comparison table
    └── ManageSubscription.tsx   - Self-serve billing portal trigger button
```

### 3.3 Core Capabilities Provided

1. **Idempotent Webhook Processing**:
   - Stores processed `event_id`s in `billing_webhook_events` to prevent double-crediting on provider retries.
   - Dispatches cleanly to local typed event handlers: `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`.
2. **Framework-Adapted Raw Body Ingestion**:
   - In Next.js App Router: uses `req.text()` for cryptographic signature verification.
   - In Express / Fastify: injects the appropriate `express.raw({ type: 'application/json' })` parser.
3. **Database Independence**:
   - Drizzle schema: exports `billingCustomers` and `billingSubscriptions` with relations to the existing `users` table.
   - Prisma schema: appends models with foreign keys to `User`.

---

## 4. Companion Selection: `@sedim/storage`

As a lightweight follow-up that does not require database persistence, `@sedim/storage` stamps:
- S3-compatible presigned URL generation (AWS S3, Cloudflare R2, MinIO).
- Direct browser-to-bucket upload signatures.
- Standard route handlers under `/api/storage/upload-url`.

---

## 5. Next Steps and Implementation Plan

1. **RFC Review**: Solicit community feedback on GitHub Discussion #25 regarding provider priorities (Stripe vs. LemonSqueezy vs. Paddle).
2. **Scaffold Package**: Initialize `packages/billing` in the monorepo following the `createBillingPlanConfig` specification established in [#32](https://github.com/Sedimie/Sedim/issues/32).
3. **Registry Entry**: Publish `registry/billing/latest.json`.
4. **Playground Verification**: Validate end-to-end stamping across Next.js and Express fixtures.
