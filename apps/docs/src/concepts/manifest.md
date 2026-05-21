# Manifest

The manifest (plan-config) defines every aspect of a module stamp — what files to create, how to modify existing files, what dependencies to install, and what features to wire together.

## Plan Config

Each module has a `plan-config.ts` at its root:

```typescript
// packages/auth/src/plan-config.ts
export const planConfig = {
  name: 'auth',
  version: '0.2.0',

  files: [
    {
      path: 'src/sedim/auth/core/hash-password.ts',
      overwriteStrategy: 'skip',
      template: 'hash-password.ts.njk',
    },
  ],

  modifications: [
    {
      path: 'src/app.ts',
      injectImports: [
        { symbol: 'authRouter', from: './sedim/auth/adapters/express' }
      ],
      injectMiddleware: 'authRouter',
    },
  ],

  dependencies: ['@sedim/auth'],
};
```

## Overwrite Strategies

| Strategy | Behavior |
|----------|----------|
| `skip` | Never modify — file is user-owned after stamping |
| `ask` | Prompt before overwriting — for config pages |
| `append` | Append to end of file — for router registration |
| `inject` | Inject into a specific section of an existing file |

## Feature Gating

Features are conditionally included based on your `sedim.config.ts`:

```typescript
{
  when: (ctx) => ctx.features.includes('google-oauth'),
  files: [ /* OAuth files only if provider selected */ ],
}
```

## Templates

Templates use Nunjucks (`.njk`). They have access to the render context which includes:
- `framework` — 'express' | 'hono' | 'nextjs'
- `orm` — 'drizzle' | 'prisma' | null
- `language` — 'ts' | 'js'
- `features` — selected feature array
- `ui` — 'headless' | 'tailwind' | 'themed'