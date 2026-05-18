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
  'jose',
  'jsonwebtoken',
]

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

const SCHEMA_FILE_CANDIDATES = [
  'src/db/schema.ts',
  'src/db/schema.js',
  'src/lib/db/schema.ts',
  'src/schema.ts',
  'prisma/schema.prisma',
]

// ── User table analysis ───────────────────────────────────────

export interface UserTableAnalysis {
  /** missing = no users table found, compatible = has all needed columns,
   *  needs-migration = missing some addable columns, incompatible = structurally wrong */
  status: 'missing' | 'compatible' | 'needs-migration' | 'incompatible'
  existingColumns: string[]
  missingColumns: string[]
  /** Ready-to-run ALTER TABLE statements when status is needs-migration */
  alterStatements: string[]
  incompatibleReason?: string
}

function extractDrizzleColumns(content: string, tableName: string): string[] {
  const tableRegex = new RegExp(
    `export const ${tableName}\\s*=\\s*(?:pgTable|mysqlTable|sqliteTable)\\s*\\([^,]+,\\s*\\{([^}]+)\\}`,
    's',
  )
  const match = content.match(tableRegex)
  if (!match?.[1]) return []
  return [...match[1].matchAll(/^\s*(\w+)\s*:/gm)].map(m => m[1] ?? '').filter(Boolean)
}

function extractPrismaColumns(content: string, modelName: string): string[] {
  const modelRegex = new RegExp(`model ${modelName}\\s*\\{([^}]+)\\}`, 's')
  const match = content.match(modelRegex)
  if (!match?.[1]) return []
  return [...match[1].matchAll(/^\s+(\w+)\s+\w/gm)].map(m => m[1] ?? '').filter(Boolean)
}

function analyseUserTable(existingColumns: string[]): UserTableAnalysis {
  const norm = existingColumns.map(c => c.toLowerCase())

  // must have email — without it the table is unusable for auth
  if (!norm.some(c => c === 'email')) {
    return {
      status: 'incompatible',
      existingColumns,
      missingColumns: ['email'],
      alterStatements: [],
      incompatibleReason:
        'No "email" column found. Auth requires an email column for user identification.',
    }
  }

  const missingColumns: string[] = []
  const alterStatements: string[] = []

  if (!norm.some(c => c === 'email_verified' || c === 'emailverified')) {
    missingColumns.push('email_verified')
    alterStatements.push(
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;',
    )
  }
  if (!norm.some(c => c === 'password_hash' || c === 'passwordhash')) {
    missingColumns.push('password_hash')
    alterStatements.push('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;')
  }
  if (!norm.some(c => c === 'created_at' || c === 'createdat')) {
    missingColumns.push('created_at')
    alterStatements.push(
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();',
    )
  }

  if (missingColumns.length === 0) {
    return { status: 'compatible', existingColumns, missingColumns: [], alterStatements: [] }
  }

  return { status: 'needs-migration', existingColumns, missingColumns, alterStatements }
}

// ── Extended return type ──────────────────────────────────────

export interface AuthSignalsResult extends SchemaSignals {
  userTableAnalysis: UserTableAnalysis
}

// ── Main export ───────────────────────────────────────────────

export async function detectAuthSignals(projectRoot: string): Promise<AuthSignalsResult> {
  const signals: string[] = []
  let existingAuthDetected = false
  const tables: string[] = []
  let probableUserTable: string | null = null
  let userTableAnalysis: UserTableAnalysis = {
    status: 'missing',
    existingColumns: [],
    missingColumns: ['email_verified', 'password_hash'],
    alterStatements: [],
  }

  // check known auth packages
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

  // scan schema files
  for (const schemaFile of SCHEMA_FILE_CANDIDATES) {
    const filePath = path.join(projectRoot, schemaFile)
    if (!(await exists(filePath))) continue

    try {
      const content = await readText(filePath)
      const isPrisma = schemaFile.endsWith('.prisma')

      // extract table/model names
      const found = isPrisma
        ? [...content.matchAll(/^model (\w+)\s*\{/gm)].map(m => m[1] ?? '')
        : [
            ...content.matchAll(
              /export const (\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\s*\(/g,
            ),
          ].map(m => m[1] ?? '')

      tables.push(...found.filter(Boolean))

      // check auth column signals
      for (const col of AUTH_COLUMN_SIGNALS) {
        if (content.includes(col)) {
          signals.push(`"${col}" column found in ${schemaFile}`)
          existingAuthDetected = true
        }
      }

      // find probable user table and analyse it
      if (!probableUserTable) {
        const userTableNames = ['users', 'user', 'accounts', 'members']
        for (const name of userTableNames) {
          const match = found.find(t => t.toLowerCase() === name)
          if (match) {
            probableUserTable = match
            const cols = isPrisma
              ? extractPrismaColumns(content, match)
              : extractDrizzleColumns(content, match)
            userTableAnalysis = analyseUserTable(cols)
            break
          }
        }
      }
    } catch {
      /* unreadable */
    }
  }

  return {
    tables,
    probableUserTable,
    authSignals: signals,
    existingAuthDetected,
    userTableAnalysis,
  }
}
