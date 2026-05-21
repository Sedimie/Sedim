# Sedim Documentation

This directory contains the source for [sedim.dev/docs](https://sedim.dev/docs), built with [VitePress](https://vitepress.dev).

## Setup

```bash
cd apps/docs
pnpm install
pnpm dev      # start dev server at localhost:5173
pnpm build    # build for production
pnpm preview  # preview production build
```

## Structure

```
docs/
├── public/              # static assets
├── src/
│   ├── guide/           # getting started, installation
│   ├── auth/            # auth module reference
│   ├── cli/             # CLI reference
│   ├── concepts/        # stamping model, registry
│   ├── guides/           # how-to guides (OAuth, TOTP, production)
│   └── roadmap/         # project roadmap
├── index.md             # homepage (redirects to /guide)
└── package.json
```

## Adding Pages

Create a new `.md` file in the appropriate section. The sidebar navigation is configured in `.vitepress/config.ts`.

## Deploying

The docs deploy automatically via GitHub Actions on push to `main` — see `.github/workflows/docs.yml`. The site is hosted on Cloudflare Pages.

## Local Preview

From the monorepo root:

```bash
cd apps/docs
pnpm dev
```

The site will be available at `http://localhost:5173`.