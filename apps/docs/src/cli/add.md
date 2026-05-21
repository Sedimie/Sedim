# sedim add

Add a feature module to your project.

```bash
sedim add <module> [flags]
```

**Example:**

```bash
sedim add auth
sedim add auth --dry-run
sedim add auth --force
```

## Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Show what would be created without writing files |
| `--force` | Skip all confirmation prompts |

## Interactive prompts

When run without flags, `sedim add auth` will ask about:

1. **Auth providers** — multi-select: email+password, magic link, Google OAuth, GitHub OAuth, Discord OAuth, TOTP 2FA
2. **UI tier** — headless, tailwind, or themed
3. **Theme variant** — if themed is selected: modern (glassmorphism), minimal (neumorphism), or colorful (neubrutalism)
4. **Authorization** — none, RBAC, or ABAC
5. **Session transport** — session cookies or JWT

## Notes

- If no frontend companion is detected on Express or Hono, you'll be asked whether to bootstrap a React + Vite app as a sibling folder
- If your stack is unsupported (JS-only project, no ORM, or Fastify), `sedim add` will fail with a clear error explaining why
- Stamped files are owned by you — `sedim add` never overwrites user-edited core logic files