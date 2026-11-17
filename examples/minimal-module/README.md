# Minimal Example Module: Health Check

This directory provides a minimal reference implementation of a Sedim module following the [Module Authoring Contract](../../apps/web/content/reference/module-authoring.md).

## Structure

```
examples/minimal-module/
├── manifest.json          # Module discovery, supported stacks, and feature definitions
├── src/
│   └── plan-config.ts     # The createHealthPlanConfig factory producing the PlanConfig
├── templates/
│   └── health.ts          # Template source stamped into the target project
└── README.md
```

## How It Works

1. **Manifest (`manifest.json`)**:
   Declares the module `health` (version `1.0.0`) and lists compatible frameworks and ORMs.
2. **PlanConfig (`src/plan-config.ts`)**:
   Implements `createHealthPlanConfig(ctx, selectedFeatures)`. It determines:
   - Output destination: `${src}/sedim/health/health-check.ts`
   - Overwrite strategy: `skip` (preserves any custom user logic)
   - Code injections: Registers the route handler into the host app entrypoint.
3. **Execution**:
   The Sedim engine invokes `createHealthPlanConfig`, validates dependencies, resolves templates, and writes files directly into the target project with zero runtime dependency on Sedim.
