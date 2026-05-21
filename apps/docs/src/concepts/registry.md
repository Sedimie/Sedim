# Registry

The registry is a versioned manifest of module stamps. It tells the CLI exactly what files to create, what to modify, and what dependencies to install.

## Local Registry

For development and offline use, manifests live in the repo:

```
registry/
└── auth/
    └── latest.json
```

The CLI loads from local first, then falls back to remote.

## Remote Registry

Production manifests are hosted on GitHub:

```
https://raw.githubusercontent.com/sedim-dev/registry/main/modules/<module>/latest.json
```

A versioned path is also supported:
```
https://raw.githubusercontent.com/sedim-dev/registry/refs/tags/v0.2.0/modules/auth/latest.json
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
1. Loads `registry/auth/latest.json` from local
2. Merges with your `sedim.config.ts` selections
3. Builds the install plan
4. Executes file operations

If `latest.json` is missing locally, it fetches from the remote registry.