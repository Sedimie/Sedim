import path from 'node:path'
import type { DBType, Detected } from '../planning/types'
import { exists, readJSON, readText } from '../shared/fs'

type PkgJSON = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function hasDep(pkg: PkgJSON, name: string): boolean {
  return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
}

// parses a DATABASE_URL prefix to a DBType
function dbTypeFromURL(url: string): DBType | null {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgres'
  if (url.startsWith('mysql://')) return 'mysql'
  if (url.startsWith('file:') || url.startsWith('sqlite://')) return 'sqlite'
  if (url.startsWith('mongodb://') || url.startsWith('mongodb+srv://')) return 'mongodb'
  return null
}

export async function detectDB(projectRoot: string): Promise<Detected<DBType>> {
  const evidence: string[] = []

  // deps are the most reliable — driver packages are explicit choices
  try {
    const pkg = await readJSON<PkgJSON>(path.join(projectRoot, 'package.json'))

    const postgresDrivers = [
      'pg',
      'postgres',
      '@neondatabase/serverless',
      '@vercel/postgres',
      'pg-native',
    ]
    const mysqlDrivers = ['mysql2', '@planetscale/database']
    const sqliteDrivers = ['better-sqlite3', '@libsql/client', 'bun:sqlite']
    const mongoDrivers = ['mongodb', 'mongoose']

    for (const dep of postgresDrivers) {
      if (hasDep(pkg, dep)) {
        evidence.push(`"${dep}" in dependencies`)
        return { value: 'postgres', confidence: 'high', evidence }
      }
    }
    for (const dep of mysqlDrivers) {
      if (hasDep(pkg, dep)) {
        evidence.push(`"${dep}" in dependencies`)
        return { value: 'mysql', confidence: 'high', evidence }
      }
    }
    for (const dep of sqliteDrivers) {
      if (hasDep(pkg, dep)) {
        evidence.push(`"${dep}" in dependencies`)
        return { value: 'sqlite', confidence: 'high', evidence }
      }
    }
    for (const dep of mongoDrivers) {
      if (hasDep(pkg, dep)) {
        evidence.push(`"${dep}" in dependencies`)
        return { value: 'mongodb', confidence: 'high', evidence }
      }
    }
  } catch {
    /* no package.json */
  }

  // drizzle.config.ts dialect field — read as text, regex is enough
  const drizzleConfigs = ['drizzle.config.ts', 'drizzle.config.js']
  for (const file of drizzleConfigs) {
    const filePath = path.join(projectRoot, file)
    if (await exists(filePath)) {
      try {
        const content = await readText(filePath)
        if (
          content.includes("dialect: 'postgresql'") ||
          content.includes('dialect: "postgresql"')
        ) {
          evidence.push(`dialect: postgresql in ${file}`)
          return { value: 'postgres', confidence: 'high', evidence }
        }
        if (content.includes("dialect: 'mysql'") || content.includes('dialect: "mysql"')) {
          evidence.push(`dialect: mysql in ${file}`)
          return { value: 'mysql', confidence: 'high', evidence }
        }
        if (content.includes("dialect: 'sqlite'") || content.includes('dialect: "sqlite"')) {
          evidence.push(`dialect: sqlite in ${file}`)
          return { value: 'sqlite', confidence: 'high', evidence }
        }
      } catch {
        /* unreadable */
      }
    }
  }

  // .env / .env.local DATABASE_URL parsing — weakest signal
  const envFiles = ['.env', '.env.local', '.env.development']
  for (const file of envFiles) {
    const filePath = path.join(projectRoot, file)
    if (await exists(filePath)) {
      try {
        const content = await readText(filePath)
        const match = content.match(/DATABASE_URL=["']?([^\s"']+)/)
        if (match?.[1]) {
          const dbType = dbTypeFromURL(match[1])
          if (dbType) {
            evidence.push(`DATABASE_URL prefix in ${file}`)
            return { value: dbType, confidence: 'medium', evidence }
          }
        }
      } catch {
        /* unreadable */
      }
    }
  }

  evidence.push('no database signals found')
  return { value: 'unknown', confidence: 'low', evidence }
}
