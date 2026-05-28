# Sedim Web

The public marketing site and documentation for Sedim.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** CSS Modules

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Deployment

This app is deployed independently via a sync workflow.

On every push to `main` that changes files in `apps/web/`, a GitHub Action syncs the contents to the [`sedim-web`](https://github.com/Sedimie/sedim-web) repository, which Vercel watches for deployments.
