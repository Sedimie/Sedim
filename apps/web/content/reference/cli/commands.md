---
title: CLI commands
description: Complete reference for all sedim CLI commands.
slug: cli/commands
---

## sedim init

Detect your stack and initialize sedim in this project.

```bash
sedim init
sedim init --force   # reinitialize even if already set up
```

## sedim add

Install a module into your project.

```bash
sedim add auth
sedim add auth --dry-run   # preview without writing
sedim add auth --force     # skip conflict checks
```

## sedim plan

Compute and preview the install plan without writing files.

```bash
sedim plan auth
```

## sedim diff

Show per-file diffs of what a module install would change.

```bash
sedim diff auth
```

## sedim continue

Resume an interrupted module install.

```bash
sedim continue auth
```

## sedim doctor

Validate your setup and diagnose common issues.

```bash
sedim doctor
```
