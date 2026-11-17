---
title: Module Authoring Contract
description: Complete reference for authoring stampable Sedim modules, including PlanConfig, manifest schemas, and stamping lifecycle.
slug: reference/module-authoring
---

# Module Authoring Contract

Sedim is designed as a modular, open code-generation engine. Instead of publishing black-box npm packages, Sedim allows authors to build **stampable modules** that generate clean, editable, type-safe source code directly into user applications.

This document specifies the contract between a module author and the Sedim engine.

---

## Architecture Overview

A Sedim module consists of two core contracts:
1. **Module Manifest (`registry/<module>/latest.json`)**: Declares the module's capabilities, supported frameworks/ORMs, required environment variables, and selectable features.
2. **Plan Configuration Factory (`create<Module>PlanConfig`)**: A deterministic function that receives the detected project context (`DetectedContext`) and user-selected features, and returns an `InstallPlanConfig` (`PlanConfig`) instructing Sedim what files to stamp, what AST injections to apply, and what dependencies to install.

```
┌────────────────────────────────────────────────────────┐
│                   Sedim CLI Engine                     │
├────────────────────┬───────────────────────────────────┤
│ 1. detectContext() │ Analyzes framework, ORM, DB, etc. │
│ 2. loadManifest()  │ Reads registry/<module>/latest.json│
│ 3. user prompts    │ Selects features from manifest    │
│ 4. planConfig()    │ Calls create<Module>PlanConfig()  │
│ 5. buildPlan()     │ Computes files, diffs, conflicts  │
│ 6. writeFiles()    │ Stamps source code into project   │
└────────────────────┴───────────────────────────────────┘
```

---

## 1. Module Manifest Specification

Every module publishes a manifest file at `registry/<module>/latest.json`. This JSON document defines the module metadata, feature taxonomy, and compatibility matrix.

### Schema (`ModuleManifest`)

```typescript
export interface ModuleManifest {
  name: string
  version: string
  layers: {
    protocol: string[]
    logic: string[]
    persistence: {
      tables: string[]
      requires: string[]
    }
    contract: {
      types: string
    }
    adapter: {
      frameworks: Framework[]
      orms: ORM[]
    }
    delivery: {
      stamps: string[]
    }
    ui: {
      headless: boolean
      tailwind: boolean
      themes: string[]
    }
  }
  features: {
    providers?: string[]
    authorization?: string[]
    ui?: UILevel[]
    session?: string[]
    security?: string[]
  }
  requires: {
    envVars: string[]
    peerModules: string[]
  }
  envVarMeta?: Record<string, {
    description: string
    example?: string
    required: boolean
    requiredFor?: string[]
  }>
}
```

### Manifest Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Unique module identifier (e.g. `auth`, `health`, `analytics`). |
| `version` | `string` | Semantic version string (e.g. `0.2.0`). |
| `layers.adapter` | `object` | Matrix of supported `frameworks` (`nextjs`, `express`, `hono`, `fastify`) and `orms` (`drizzle`, `prisma`, `none`). |
| `features` | `object` | Groups of features prompted to the user during `sedim add <module>`. |
| `requires.envVars` | `string[]` | Environment variables that this module may require. |
| `envVarMeta` | `object` | Metadata per environment variable describing purpose, examples, and conditional requirement (`requiredFor`). |

---

## 2. PlanConfig Specification

The `PlanConfig` is the blueprint executed by Sedim's thinker. Module packages implement an entrypoint named `create<Module>PlanConfig`.

### Function Signature

```typescript
export function create<Module>PlanConfig(
  ctx: DetectedContext,
  selectedFeatures: string[],
): PlanConfig
```

### Input: `DetectedContext`

The engine provides full visibility into the user's project:
- `ctx.projectRoot`: Absolute path to project root.
- `ctx.framework`: Detected framework (`nextjs`, `express`, `hono`, `fastify`, `unknown`).
- `ctx.orm`: Detected ORM (`drizzle`, `prisma`, `none`).
- `ctx.db`: Detected database dialect (`postgres`, `mysql`, `sqlite`, `unknown`).
- `ctx.language`: Detected language (`typescript`, `javascript`).
- `ctx.structure.srcDir`: Base source directory (`src` or `.`).
- `ctx.codeArchitecture.appEntrypoint`: Entrypoint file path (e.g., `src/index.ts`, `src/app.ts`).

### Output: `PlanConfig` Interface

```typescript
export interface PlanConfig {
  moduleName: string
  version: string
  templates: TemplateConfig[]
  injections: InjectionConfig[]
  dependencies: string[]
  devDependencies: string[]
  envVars: EnvVarConfig[]
  schemaTables: string[]
  peerContracts: PeerContract[]
}
```

---

## 3. Template Configuration (`TemplateConfig`)

Templates represent source code stamped into the user's project.

```typescript
export interface TemplateConfig {
  /** Template key resolving to the template source file */
  templateKey: string

  /** Target path relative to project root */
  outputPath: (ctx: DetectedContext) => string

  /** Strategy when destination file already exists */
  overwriteStrategy: 'skip' | 'overwrite' | 'ask'
}
```

### Overwrite Strategies
- `'skip'`: Never overwrite if file exists. Ideal for user-owned logic files and configuration.
- `'overwrite'`: Overwrite existing file. Use sparingly for pure generated barrels.
- `'ask'`: Prompt the user interactively with a diff preview before overwriting.

---

## 4. AST Injection Configuration (`InjectionConfig`)

Injections make surgical additions to user entrypoints without rewriting existing architecture.

```typescript
export interface InjectionConfig {
  type: 'import' | 'route' | 'middleware' | 'provider-wrap'
  target: (ctx: DetectedContext) => string | null
  variants: Partial<Record<Framework, InjectionVariant>>
  fallback?: InjectionVariant
}

export interface InjectionVariant {
  payload: string
  anchor: string
  position: 'before' | 'after'
}
```

### Injection Best Practices
- **Minimal Touch**: Stamp new files under `src/sedim/<module>/` whenever possible; inject at most one import and one router mount in the user's entrypoint.
- **Null Safety**: If a project style doesn't require an injection (e.g. Next.js App Router using file-based routes), return `null` from `target` to cleanly skip the injection.

---

## 5. Environment Variables (`EnvVarConfig`)

```typescript
export interface EnvVarConfig {
  key: string
  description: string
  example?: string
  default?: string
  required: boolean
}
```

Sedim writes these variables to the user's `.env` file without overwriting existing keys, appending comments and examples.

---

## 6. Stamping Conventions & User Ownership

Module authors must adhere to the Sedim design philosophy:
1. **Zero Runtime Engine Dependency**: The stamped code in user projects MUST NOT import `@sedim/*` packages. It must be standalone, editable code depending only on open standard libraries (e.g. `jose`, `argon2`, `@oslojs/*`).
2. **Predictable Directory Structure**: All stamped files should land under `${src}/sedim/<module>/`.
3. **Clean Relative Imports**: All relative imports within stamped templates must resolve correctly regardless of user directory structure.
