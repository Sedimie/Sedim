---
title: Getting started with auth
description: Install, init, and add auth to your project in under two minutes.
slug: auth/quickstart
date: 2026-06-01
tags:
  - auth
  - quickstart
---

## Prerequisites

You need an existing project with a supported framework and ORM:

- **Frameworks:** Next.js (App Router), Express, Hono
- **ORMs:** Drizzle or Prisma
- **Node:** 18 or higher

## Install the CLI

```bash
npm install -g @sedim/cli
sedim --version
```

## Initialize your project

```bash
cd my-project
sedim init
```

Sedim detects your stack and writes `sedim.config.ts`. Edit it if anything is wrong.

## Add auth

```bash
sedim add auth
```

The CLI walks you through feature selection, UI tier, plan review, and environment variables.

## Migrate and run

```bash
# Drizzle
npx drizzle-kit push

# or Prisma
npx prisma migrate dev --name add_auth

npm run dev
```

## What you get

Files land in `src/sedim/auth/`: core logic, adapters, UI components, and schema. You own every line.
