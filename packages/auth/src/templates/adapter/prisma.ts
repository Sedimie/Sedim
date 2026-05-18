// src/sedim/auth-adapter.ts
// ── Auth database adapter ─────────────────────────────────────
// Wires your Prisma client to the auth module.
// Edit the import to match your project's actual path.

import { prisma } from '../lib/prisma.js'     // ← your Prisma client instance
import { createPrismaAdapter } from './sedim/auth/adapters/prisma.js'

export const dbAdapter = createPrismaAdapter(prisma)
