# Project Roadmap

## Current Status

**Auth module v0.2.0** — feature-complete, tested, production-ready.

The Sedim CLI and registry infrastructure are operational. The first module (auth) is the foundation — everything after builds on the same stamping engine.

---

## Roadmap

### v0.3.0 — Auth Hardening Release
- [ ] `RedisRateLimitStore` implementation (fully swap the in-memory store for Redis)
- [ ] `email.ts` deprecation path — remove old parallel email system
- [ ] Playground CI — automated test that verifies stamped output compiles in all fixtures
- [ ] OAuth callback URL validation beyond state param

### v1.0.0 — First Stable Release
- [ ] Auth module: full integration test suite against all 4 playground fixtures
- [ ] `sedim.config.ts` schema tightened (preferences and overrides fully validated)
- [ ] Registry CI — automated manifest validation on version bump
- [ ] `sedim add auth --update` — update an already-stamped module to a new version

### v1.1.0 — Chat Module (first sibling module)
- [ ] Chat module manifest (`registry/chat/latest.json`)
- [ ] Real-time presence, typing indicators
- [ ] Conversation CRUD with participant permissions
- [ ] Stamps into `src/sedim/chat/` using the same engine

### v1.2.0 — Notifications Module
- [ ] Multi-channel: email, push, SMS
- [ ] Notification preferences per user
- [ ] Digest mode (batch notifications)

### v1.x — More Modules
- [ ] **Payments** — Stripe integration, subscription management
- [ ] **File Storage** — S3/R2 uploads, signed URLs, image resizing
- [ ] **Search** — full-text search with Typesense/Meilisearch
- [ ] **AI** — LLM integration stubs, prompt management

### v2.0.0 — Plugin System
- [ ] Third-party module support via `sedim.module.ts` in npm packages
- [ ] Module marketplace at sedim.dev
- [ ] Verified publisher system

---

## Registry

Available modules: **auth** (v0.2.0)

Proposed modules are tracked as GitHub discussions — see [the roadmap discussion](https://github.com/sedimie/sedim/discussions).

---

## Contributing a New Module

The module system is open. To build a new module:

1. Create `packages/<module-name>/` in the monorepo (or a separate repo)
2. Implement the feature as stamped files in `src/templates/`
3. Write `src/plan-config.ts` with the stamping rules
4. Add the manifest to `registry/<module-name>/latest.json`
5. The CLI will pick it up automatically

See [the contributing guide](/contributing) for the full module authoring guide.