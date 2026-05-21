# Registry

The registry is a versioned manifest of module stamps. It tells the CLI exactly what files to create, what to modify, and what dependencies to install.

## Local Registry

For development and offline use, manifests live in the repo:

```
registry/
├── auth/
│   └── latest.json
└── modules/
    └── <module>/
        └── latest.json
```

The CLI loads from local first, then falls back to remote.

## Remote Registry

For production, manifests are also published to GitHub:

```
https://raw.githubusercontent.com/sedimie/sedim/refs/heads/main/registry/<module>/latest.json
```

A versioned path is also supported:
```
https://raw.githubusercontent.com/sedimie/sedim/refs/tags/v0.2.0/registry/auth/latest.json
```

## Manifest Structure

Each manifest contains:

```json
{
  "version": "0.2.0",
  "name": "auth",
  "description": "Production-ready auth module",
  "dependencies": ["@sedim/auth"],
  "features": {
    "email-password": { /* feature config */ },
    "google-oauth": { /* provider config */ }
  },
  "plan": {
    "files": [
      {
        "path": "src/sedim/auth/core/hash-password.ts",
        "overwriteStrategy": "skip",
        "template": "..."
      }
    ]
  }
}
```

## Version Resolution

When you run `sedim add auth`, the CLI:
1. Loads `registry/auth/latest.json` from local (monorepo) or remote (published package)
2. Merges with your `sedim.config.ts` selections
3. Builds the install plan
4. Executes file operations