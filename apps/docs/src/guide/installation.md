# Installation

## System Requirements

- **Node.js** 18 or higher
- **OS** — macOS, Linux, Windows (WSL recommended)
- **Package manager** — npm, pnpm, bun, or yarn

Sedim works with any Node.js project. It detects and stamps into:

| Framework | ORM | Database |
|-----------|-----|----------|
| Next.js | Drizzle | PostgreSQL, MySQL, SQLite |
| Express | Prisma | MongoDB |
| Hono | | |
| Fastify | *(planned)* | |

## Install the CLI

```bash
npm install -g @sedim/cli
```

This installs the `sedim` binary globally. Verify:

```bash
sedim --version
```

## Update the CLI

```bash
npm install -g @sedim/cli@latest
```

Or check for updates without installing:

```bash
npm show @sedim/cli version
```

## Uninstall

```bash
npm uninstall -g @sedim/cli
```

## Next Steps

- [Quick Start](./quick-start) — add auth to a project in 5 minutes
- [First Auth Setup](./first-auth) — configure OAuth providers and run your first auth flow