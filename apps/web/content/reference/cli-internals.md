---
title: CLI Internals & Architecture
description: Deep dive into the Sedim CLI engine internals, detector heuristics, thinker planning pipeline, and writer AST transformations.
slug: reference/cli-internals
---

# CLI Internals & Engine Architecture

The Sedim CLI operates as a deterministic, three-phase compilation pipeline: **Detect**, **Think**, and **Write**.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  1. DETECTOR    │ ────► │   2. THINKER    │ ────► │   3. WRITER     │
│                 │       │                 │       │                 │
│ • Stack AST     │       │ • PlanConfig    │       │ • Atomic Files  │
│ • Dependencies  │       │ • Remote Fetch  │       │ • AST Injection │
│ • Context Graph │       │ • Conflict Tree │       │ • Env Patching  │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## C4 Architectural Breakdown

### Level 1: System Context Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Developer                             │
└──────────────────────────────┬──────────────────────────────┘
                               │ runs CLI commands (add, plan, diff)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sedim CLI Engine                         │
├──────────────────────────────┬──────────────────────────────┤
│ Reads project context        │ Pulls module blueprints      │
│ Writes editable source code  │ Staves off black-box deps    │
└──────────────┬───────────────┴──────────────▲───────────────┘
               │                              │
               │ Stamps files                 │ Fetches manifests & templates
               ▼                              │
┌──────────────────────────────┐┌─────────────┴───────────────┐
│     User Application Repo    ││   Remote Module Registry    │
│  (Next.js / Express / Fastify││  (GitHub Raw Content CDN)   │
└──────────────────────────────┘└─────────────────────────────┘
```

### Level 2: Engine Containers & Pipeline

```
                               ┌──────────────────────────────┐
                               │       projectRoot            │
                               └──────────────┬───────────────┘
                                              │
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. DETECTOR (packages/cli/src/detector)                                                │
│                                                                                        │
│  • detectFramework: AST search for call expressions (express(), fastify(), new Hono()) │
│  • detectORM: Scans package.json and schema locations (drizzle.config, prisma/schema)  │
│  • detectDatabase: Infers driver dialect (postgres, mysql, sqlite)                    │
│  • detectCodeArchitecture: Resolves app router vs pages router, entrypoints, srcDir    │
│  • detectAuthSignals: Scans for existing auth libraries to prevent collision          │
│                                                                                        │
│  Output: DetectedContext (confidence-weighted metadata)                                │
└─────────────────────────────────────────────┬──────────────────────────────────────────┘
                                              │
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. THINKER (packages/cli/src/thinker)                                                  │
│                                                                                        │
│  • loadModuleManifest: Fetches registry/<module>/latest.json (local cache first)       │
│  • loadPlanConfig: Evaluates create<Module>PlanConfig(ctx, features)                   │
│  • buildPlan: Reifies templates, maps output destinations, computes AST injection     │
│    anchors, generates migration names, and assigns rollback strategies                │
│  • classifyConflicts: Categorizes file overwrites and schema mutations                 │
│                                                                                        │
│  Output: InstallPlan (fully resolved execution graph)                                  │
└─────────────────────────────────────────────┬──────────────────────────────────────────┘
                                              │
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. WRITER (packages/cli/src/writer)                                                    │
│                                                                                        │
│  • writeFile: Atomic file creation with overwrite strategy ('skip' | 'overwrite')      │
│  • patchFile: Targeted code modifications using ts-morph AST anchors                   │
│  • injectImports: Injects named/default imports without reformatting existing lines    │
│  • updateEnv: Idempotent environment variable injection preserving comments and values │
│                                                                                        │
│  Output: Stamped, compile-ready codebase                                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Detector Subsystem

The Detector does not rely solely on `package.json` strings; it evaluates **confidence levels** (`high`, `medium`, `low`) through structural signals:
1. **Config Signals**: High-confidence files like `next.config.ts` or `drizzle.config.ts`.
2. **Dependency Signals**: Presence of framework or ORM packages.
3. **AST Inspection**: Uses `ts-morph` to parse user entrypoint files (`src/app.ts`, `src/index.ts`, `src/server.ts`) and confirm actual instantiation calls (e.g. `express()`, `fastify()`).

---

## 2. Thinker Subsystem

The Thinker converts dynamic user input into a static `InstallPlan`:
- **Template Resolution**: Resolves template keys against the remote GitHub registry or local overrides. Applies dynamic mustache-style replacements (`{{FRAMEWORK}}`, `{{UI_EXPORTS}}`).
- **Conflict Classification**: Compares computed files with the host filesystem. Files that exist with differing contents are flagged as conflicts and surfaced during dry-runs.
- **Rollback Hints**: Every operation in the plan records rollback hints (`delete` for created files, original contents for patched files) enabling safe abortion if an error occurs.

---

## 3. Writer Subsystem

The Writer applies the plan safely and atomically:
- **AST Code Injection**: Rather than fragile regex matching, AST manipulation identifies exact parent nodes and anchors (e.g. `before: 'app.listen'`) to place routes and middleware.
- **Environment Management**: Appends missing environment variables to `.env` with descriptions and default placeholders while leaving user-defined values intact.
- **Package Installation**: Invokes the detected package manager (`npm`, `pnpm`, `yarn`, `bun`) to install peer dependencies.
