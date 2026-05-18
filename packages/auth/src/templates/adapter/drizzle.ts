// src/sedim/auth-adapter.ts
// ── Auth database adapter ─────────────────────────────────────
// Wires your Drizzle db instance to the auth module.
// The import path below was detected from your project — verify it points
// to the file that exports your Drizzle `db` instance.

import { db } from '{{DB_INSTANCE_IMPORT}}'
import { eq, and, lt } from 'drizzle-orm'
import { createDrizzleAdapter } from './auth/adapters/drizzle.js'
import { authSchema } from './auth/schema.js'

export const dbAdapter = createDrizzleAdapter(db, authSchema, eq, and, lt)
