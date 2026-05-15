import path from 'node:path'
import type { SchemaSignals } from '../planning/types'
import { exists, readJSON, readText } from '../shared/fs'

type PkgJSON = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function hasDep(pkg: PkgJSON, name: string): boolean {
  return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
}

// known auth packages — any of these means auth is likely already set up
const KNOWN_AUTH_PACKAGES = [
  'next-auth',
  '@auth/core',
  '@auth/drizzle-adapter',
  '@auth/prisma-adapter',
  'lucia',
  'better-auth',
  'passport',
  'passport-local',
  'clerk',
  '@clerk/nextjs',
  '@clerk/clerk-sdk-node',
  'jose', // JWT library, strong signal
  'jsonwebtoken',
]

// column names in schema files that suggest auth tables exist
const AUTH_COLUMN_SIGNALS = [
  'password',
  'password_hash',
  'hashed_password',
  'email_verified',
  'emailVerified',
  'verification_token',
  'reset_token',
  'session_token',
  'access_token',
  'refresh_token',
]

// common locations for auth setup files
const AUTH_FILE_CANDIDATES = [
  'src/lib/auth.ts',
  'src/lib/auth.js',
  'src/auth.ts',
  'src/auth.js',
  'auth.config.ts',
  'auth.config.js',
  'src/server/auth.ts',
  'src/server/auth.js',
  'src/app/api/auth/[...nextauth]/route.ts',
  'src/pages/api/auth/[...nextauth].ts',
]

// schema files to scan for auth column signals
const SCHEMA_FILE_CANDIDATES = [
  'src/db/schema.ts',
  'src/db/schema.js',
  'src/lib/db/schema.ts',
  'src/schema.ts',
  'prisma/schema.prisma',
]

export async function detectAuthSignals(projectRoot: string): Promise<SchemaSignals> {
  const signals: string[] = []
  let existingAuthDetected = false

  // check known auth packages in deps
  try {
    const pkg = await readJSON<PkgJSON>(path.join(projectRoot, 'package.json'))
    for (const authPkg of KNOWN_AUTH_PACKAGES) {
      if (hasDep(pkg, authPkg)) {
        signals.push(`"${authPkg}" found in dependencies`)
        existingAuthDetected = true
      }
    }
  } catch {
    /* no package.json */
  }

  // check for auth setup files
  for (const file of AUTH_FILE_CANDIDATES) {
    if (await exists(path.join(projectRoot, file))) {
      signals.push(`auth file found: ${file}`)
      existingAuthDetected = true
    }
  }

  // scan schema files for auth column names
  const tables: string[] = []
  let probableUserTable: string | null = null

  for (const schemaFile of SCHEMA_FILE_CANDIDATES) {
    const filePath = path.join(projectRoot, schemaFile)
    if (await exists(filePath)) {
      try {
        const content = await readText(filePath)

        // extract table names — works for both drizzle and prisma syntax
        const drizzleTables = [
          ...content.matchAll(/export const (\w+)\s*=\s*pgTable|mysqlTable|sqliteTable/g),
        ].map(m => m[1])
        const prismaTables = [...content.matchAll(/^model (\w+)\s*\{/gm)].map(m => m[1])

        tables.push(...drizzleTables, ...prismaTables)

        // check for auth column signals
        for (const col of AUTH_COLUMN_SIGNALS) {
          if (content.includes(col)) {
            signals.push(`"${col}" column found in ${schemaFile}`)
            existingAuthDetected = true
          }
        }

        // guess the user table — look for common names
        const userTableNames = ['users', 'user', 'accounts', 'members']
        for (const name of userTableNames) {
          if (tables.some(t => t.toLowerCase() === name)) {
            probableUserTable = tables.find(t => t.toLowerCase() === name) ?? null
            break
          }
        }
      } catch {
        /* unreadable schema */
      }
    }
  }

  return {
    tables,
    probableUserTable,
    authSignals: signals,
    existingAuthDetected,
  }
}
