---
title: Why we built sedim
description: The stamp model - install complete features, own every line.
slug: why-sedim
date: 2026-06-01
tags:
  - announcement
---

## The problem

Every project rebuilds the same infrastructure. Auth, sessions, OAuth, rate limiting: solved problems that developers and AI agents rewrite from scratch every time.

Existing solutions fall into two camps:

1. **Runtime SDKs** - fast to start, hard to customize, vendor lock-in
2. **DIY from scratch** - full control, weeks of work, easy to get security wrong

## The stamp model

Sedim is a third option: a CLI that stamps production-ready code into your project. Not a dependency. Not a black box. Files you own forever.

```bash
sedim add auth
# → src/sedim/auth/ appears in your repo
# → no @sedim/* imports at runtime
# → edit anything, anytime
```

## What's next

Auth is the first module. Notifications, chat, payments, and WebRTC are on the roadmap, all using the same stamp model.
