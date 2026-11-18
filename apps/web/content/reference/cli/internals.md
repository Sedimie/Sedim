---
title: CLI Internals & Architecture
description: Deep dive into the Sedim CLI engine, C4 architecture diagrams, and the three-stage pipeline (detector, thinker, writer).
slug: cli/internals
---

## Overview

The Sedim CLI is a developer-tooling engine that stamps production-grade, maintainable architecture modules into existing repositories. Unlike traditional generators, it inspects your codebase's concrete AST structure, resolves conflicts before writing a single byte, and preserves user modifications permanently.

---

## C4 Architecture Diagrams

### Level 1: System Context Diagram

```
+-------------------------------------------------------------------+
|                            Developer                              |
+-------------------------------------------------------------------+
                                  |
                                  | runs `sedim add <module>`
                                  v
+--------------------+                       +----------------------+
|                    |  fetches manifests    |                      |
|     Sedim CLI      | --------------------> |    Sedim Registry    |
| (Local Executable) |                       | (GitHub Raw / Local) |
|                    |                       +----------------------+
+--------------------+
          |
          | inspects AST & writes code
          v
+--------------------+
|                    |
|   Target Project   |
| (Next/Express/...) |
+--------------------+
```

### Level 2: Container Diagram (Three Stages)

```
Target Repository Files
          |
          v
+--------------------+
|    1. Detector     |  AST Scan (ts-morph) & Dependency Analysis
|                    |  --> Output: DetectedContext
+--------------------+
          |
          v
+--------------------+
|    2. Thinker      |  Manifest Loading, Feature Selection, PlanConfig
|                    |  --> Output: InstallPlan & SessionState
+--------------------+
          |
          v
+--------------------+
|    3. Writer       |  Atomic File Writing, AST Injections, .env Updates
|                    |  --> Stamped Module in src/sedim/
+--------------------+
```

---

## 1. Detector (`packages/cli/src/detector/`)

The Detector inspects the target project and produces an immutable `DetectedContext` object describing everything necessary for planning.

### Detection Strategies

| Aspect | Implementation | Signals Used |
|---|---|---|
| **Framework** | `detect-framework.ts` | Config files (`next.config.*`), dependencies (`next`, `express`, `hono`, `fastify`), AST calls (`express()`, `new Hono()`, `fastify()`). |
| **ORM** | `detect-orm.ts` | `schema.prisma`, `drizzle.config.*`, dependency trees. |
| **Database** | `detect-db.ts` | Connection string hints, driver packages (`pg`, `mysql2`, `better-sqlite3`, `@libsql/client`). |
| **Architecture** | `detect-code-architecture.ts` | Locates entrypoint (`src/app.ts`, `src/index.ts`, `src/server.ts`), variable names, and AST injection anchors. |
| **Frontend** | `detect-frontend.ts` | Subdirectory & workspace scans (`client/`, `frontend/`, `apps/web/`) detecting React + Vite or Vue + Vite. |
| **Conflicts** | `detect-auth-signals.ts` | Scans for existing auth libraries (`next-auth`, `@auth/core`, `lucia`, `passport`) to prevent collisions. |

### AST Anchor Resolution

The detector uses `ts-morph` to identify insertion points without breaking formatting:
- **Import Anchors**: Identifies the last existing `ImportDeclaration` to place imports at the top of the file cleanly.
- **Route Anchors**: Identifies server listen statements (`app.listen`) or default exports (`export default app`) to mount routes immediately beforehand.

---

## 2. Thinker (`packages/cli/src/thinker/`)

The Thinker converts the `DetectedContext` and the user's selected features into a concrete, deterministic `InstallPlan`.

```typescript
export interface InstallPlan {
  moduleName: string
  selectedFeatures: string[]
  dependenciesToInstall: string[]
  devDependenciesToInstall: string[]
  envVarsToAdd: EnvVarConfig[]
  filesToCreate: FileToCreate[]
  filesToModify: FileToModify[]
  migrationsToCreate: MigrationAction[]
  injectionActions: InjectionAction[]
  conflictActions: ConflictAction[]
  rollbackHints: string[]
}
```

### Key Stages

1. **Manifest Loading** (`load-module-manifest.ts`): Checks local workspace registry (`registry/<module>/latest.json`) first, falling back to remote GitHub registry.
2. **Feature Resolution**: In interactive mode, presents feature multiselect prompts grouped by manifest categories. In non-interactive mode, applies CLI options or `sedim.config.ts` defaults.
3. **PlanConfig Execution** (`load-plan-config.ts`): Invokes `create<Module>PlanConfig(ctx, features)`.
4. **Template Resolution** (`resolve-template.ts`): Fetches or loads template files and performs variable substitution (`{{API_BASE_PATH}}`, `{{FRAMEWORK}}`, `{{COOKIE_NAME}}`).
5. **Conflict Classification** (`classify-conflicts.ts`): Cross-references planned files against the filesystem, flagging collisions as `pending-user-choice`, `skip`, or `overwrite`.
6. **Session Snapshot** (`session/`): Persists `.sedim/session.json` so interrupted operations can resume with `sedim continue`.

---

## 3. Writer (`packages/cli/src/writer/`)

The Writer applies the approved `InstallPlan` to disk in a deterministic, safe sequence:

```
Dependencies  -->  File Creation  -->  Import Injections  -->  Code Injections  -->  Env Vars
```

1. **Dependencies** (`package-manager.ts`): Runs package manager install (`pnpm`, `npm`, `yarn`, `bun`).
2. **File Creation** (`write-file.ts`): Writes files respecting `overwriteStrategy`. If a file exists and strategy is `skip`, it is left untouched.
3. **Import Injections** (`inject-imports.ts`): Prepends or inserts import statements after the last detected import.
4. **Code Injections** (`inject-code.ts`): Injects routing code, middleware registration, or layout wrappers at the exact AST anchor.
5. **Environment Variables** (`update-env.ts`): Appends required variables to `.env` with descriptions and default examples without overwriting existing secrets.

---

## Error Handling & Recovery

- All operations validate prerequisites before writing.
- Any unrecoverable failure outputs actionable next steps and retains the session snapshot.
- Rolling back: Every plan generates `rollbackHints` indicating which files were created and which were modified.
