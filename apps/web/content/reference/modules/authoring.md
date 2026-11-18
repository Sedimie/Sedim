---
title: Module authoring
description: Complete reference and guide for authoring custom stampable Sedim modules.
slug: modules/authoring
---

## Overview

Sedim is designed as an extensible, stampable module system. While auth is the flagship first-party module, any functionality—such as payments, notifications, health checks, or analytics—can be packaged and stamped into any user application.

Modules are authored once and stamped directly into the user's codebase, giving them 100% code ownership with zero runtime dependency lock-in.

---

## Architecture: The Three Stages

When a user runs `sedim add <module>`, the engine moves through three distinct stages:

```
Detector  →  Thinker  →  Writer
```

1. **Detector** (`packages/cli/src/detector/`): Inspects the target repository and builds a `DetectedContext` (framework, ORM, database, language, module system, app entrypoint, and AST injection anchors).
2. **Thinker** (`packages/cli/src/thinker/`): Loads the module manifest (`registry/<module>/latest.json`), resolves feature selections, loads the module's `plan-config.ts`, and computes an `InstallPlan`.
3. **Writer** (`packages/cli/src/writer/`): Executes the approved `InstallPlan`—installing dependencies, creating files with chosen overwrite strategies, injecting imports and routes at AST-detected anchors, and updating `.env`.

---

## Directory Structure

A complete module consists of a module package in `packages/<module>/` and a registry manifest in `registry/<module>/latest.json`:

```
Sedim/
├── registry/
│   └── <module>/
│       └── latest.json             # Remote / local manifest
└── packages/
    └── <module>/
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts            # Public barrel export
        │   ├── plan-config.ts      # create<Module>PlanConfig entrypoint
        │   └── templates/          # Code templates to stamp
        └── planConfig/
            └── plan-config.js      # Compiled ESM bundle for remote distribution
```

---

## 1. Module Manifest (`registry/<module>/latest.json`)

The manifest defines module metadata, capability layers, available features, required environment variables, and peer module contracts.

### Manifest Schema

```json
{
  "name": "health",
  "version": "0.1.0",
  "layers": {
    "protocol": ["http-json"],
    "logic": ["system-info", "uptime"],
    "adapter": {
      "frameworks": ["nextjs", "express", "hono", "fastify"]
    },
    "delivery": {
      "stamps": ["routes"]
    }
  },
  "features": {
    "checks": [
      "basic",
      "detailed"
    ]
  },
  "requires": {
    "envVars": [],
    "peerModules": []
  },
  "envVarMeta": {
    "HEALTH_SECRET": {
      "description": "Optional secret key to access detailed diagnostic checks",
      "example": "my-secret-key",
      "required": false,
      "requiredFor": ["detailed"]
    }
  }
}
```

### Manifest Fields

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Canonical name of the module (matches CLI argument `sedim add <name>`). |
| `version` | `string` | Semantic version string. |
| `layers` | `object` | Architectural classification: protocol, logic, persistence, contract, adapter, delivery, and ui. |
| `features` | `Record<string, string[]>` | Available features grouped by category. Rendered as interactive multiselect options in CLI interactive mode. |
| `requires.envVars` | `string[]` | Environment variables unconditionally required by the module. |
| `requires.peerModules` | `string[]` | Other Sedim modules that must be installed first. |
| `envVarMeta` | `Record<string, object>` | Documentation, examples, and conditional requirement flags for each env var. |

---

## 2. PlanConfig Entry Point (`plan-config.ts`)

Each module exports an entrypoint named following the convention:

```typescript
export function create<ModuleName>PlanConfig(
  ctx: DetectedContext,
  selectedFeatures: string[],
): PlanConfig
```

For example, a module named `health` exports `createHealthPlanConfig`. The thinker dynamically loads this function during plan computation.

### The `PlanConfig` Interface

```typescript
export interface PlanConfig {
  moduleName: string
  version: string
  templates: TemplateAction[]
  injections: InjectionAction[]
  dependencies: string[]
  devDependencies: string[]
  envVars: EnvVarConfig[]
  schemaTables: string[]
  peerContracts: PeerContract[]
  _unsupportedReasons?: string[]
}
```

### Template Actions (`templates`)

Templates define what files to write into the target codebase:

```typescript
export interface TemplateAction {
  templateKey: string
  outputPath: (ctx: DetectedContext) => string
  overwriteStrategy: 'skip' | 'ask' | 'overwrite'
}
```

- `templateKey`: Identifies the template source. Format: `<module>/templates/<path>`.
- `outputPath(ctx)`: Resolves destination path relative to project root. Always use `ctx.structure.srcDir ?? 'src'`.
- `overwriteStrategy`:
  - `'skip'`: Never overwrite existing files. Ideal for core application code the user is expected to customize.
  - `'ask'`: Prompt user interactively if the file already exists.
  - `'overwrite'`: Safely update generated files.

### Injection Actions (`injections`)

Injections modify existing application entrypoints (such as registering a router or wrapping providers):

```typescript
export interface InjectionAction {
  type: 'import' | 'route' | 'provider-wrap' | 'middleware' | 'env-var'
  target: (ctx: DetectedContext) => string | null
  variants: Partial<Record<Framework, {
    payload: string
    anchor: string
    position: 'before' | 'after'
  }>>
  fallback?: {
    payload: string
    anchor: string
    position: 'before' | 'after'
  }
}
```

- When the target file contains AST injection anchors (determined during detection), the engine uses the AST anchor position while utilizing the variant's `payload`.
- Returning `null` from `target(ctx)` gracefully skips injection for frameworks that do not require entrypoint modifications (e.g. Next.js file-based routes).

### Handling Unsupported Stacks

If the detected project lacks a required capability (e.g. unsupported ORM or framework), populate `_unsupportedReasons`:

```typescript
if (ctx.framework.value === 'unknown') {
  unsupportedReasons.push('Framework could not be detected. Run sedim init first.')
}
```

The CLI surfaces these reasons clearly and halts before modifying files.

---

## 3. Minimal Example Walkthrough: `@sedim/health`

The `health` module provides a complete reference implementation demonstrating manifest authoring, plan configuration, template stamping, and AST route injections across Next.js, Express, Hono, and Fastify.

### `packages/health/src/plan-config.ts`

```typescript
import type { DetectedContext, PlanConfig } from '@sedim/core'

export function createHealthPlanConfig(
  ctx: DetectedContext,
  selectedFeatures: string[],
): PlanConfig {
  const src = ctx.structure.srcDir ?? 'src'
  const framework = ctx.framework.value
  const detailed = selectedFeatures.includes('detailed')

  const templates: PlanConfig['templates'] = []
  const injections: PlanConfig['injections'] = []

  if (framework === 'nextjs') {
    templates.push({
      templateKey: detailed
        ? 'health/templates/routes/nextjs-detailed'
        : 'health/templates/routes/nextjs-basic',
      outputPath: () => `${src}/app/api/health/route.ts`,
      overwriteStrategy: 'skip',
    })
  } else if (framework === 'express') {
    templates.push({
      templateKey: detailed
        ? 'health/templates/routes/express-detailed'
        : 'health/templates/routes/express-basic',
      outputPath: () => `${src}/sedim/health/router.ts`,
      overwriteStrategy: 'skip',
    })
    injections.push({
      type: 'import',
      target: c => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        express: {
          payload: `import { healthRouter } from './sedim/health/router'`,
          anchor: 'import',
          position: 'after',
        },
      },
    })
    injections.push({
      type: 'route',
      target: c => c.codeArchitecture.appEntrypoint?.file ?? null,
      variants: {
        express: {
          payload: `app.use('/health', healthRouter)`,
          anchor: 'app.listen',
          position: 'before',
        },
      },
    })
  }

  return {
    moduleName: 'health',
    version: '0.1.0',
    templates,
    injections,
    dependencies: [],
    devDependencies: [],
    envVars: [],
    schemaTables: [],
    peerContracts: [],
  }
}
```

---

## 4. Building and Distributing

Module plan configurations are distributed as precompiled standalone ESM bundles so that global CLI installations can execute them without compiling TypeScript at runtime.

Add a build script to `package.json`:

```json
{
  "scripts": {
    "build:plan": "tsup src/plan-config.ts --format esm --outDir planConfig --no-dts --clean"
  }
}
```

Run compilation before publishing:

```bash
pnpm --filter @sedim/<module> run build:plan
```
