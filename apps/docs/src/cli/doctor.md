# sedim doctor

Diagnose environment issues before running `sedim add`.

```bash
sedim doctor
```

Checks:
- Node.js version (>= 18 required)
- Whether `sedim.config.ts` exists
- Whether an interrupted session exists (from a previous incomplete `sedim add`)
- Framework, ORM, and database detection results
- Whether `.env` or `.env.local` exists
- Whether a frontend companion was detected

Will offer to bootstrap a React + Vite app if no frontend is found on an Express or Hono project.

## When to use

Before running `sedim add` for the first time — or any time something isn't working as expected. `sedim doctor` tells you exactly what's wrong and what to fix.

## Exit codes

- `0` — all checks passed
- `1` — one or more checks failed or warned