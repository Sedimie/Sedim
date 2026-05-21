# sedim plan

Preview what a module would create without writing files.

```bash
sedim plan <module>
```

**Example:**

```bash
sedim plan auth
```

Shows the full plan including:
- All files that would be created
- All files that would be modified
- Dependencies that would be installed
- Environment variables required

Unlike `sedim add`, `sedim plan` never writes any files. It's read-only.

## When to use

- Before running `sedim add` for the first time — see exactly what would be stamped
- In CI — to verify the plan hasn't changed unexpectedly after an upgrade
- When exploring — to understand what a module does before committing to it