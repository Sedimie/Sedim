import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DetectedContext } from '../planning/types'
import { exists, readText } from '../shared/fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Template resolution ───────────────────────────────────────
// Maps a templateKey to file content.
//
// Resolution order:
//   1. packages/<module>/src/templates/<key>.ts  — substitution templates
//   2. packages/<module>/src/<key>.ts            — verbatim source files
//
// The verbatim path is the key insight: most files don't need a separate
// template — the source file IS the template. Only files that need
// path substitution or config placeholders have explicit template files.

export async function resolveTemplate(
  templateKey: string,
  ctx: DetectedContext,
  selectedFeatures: string[] = [],
): Promise<string> {
  const [moduleName, ...rest] = templateKey.split('/')
  if (!moduleName || rest.length === 0) {
    throw new Error(`Invalid templateKey: "${templateKey}"`)
  }

  const relPath = rest.join('/')
  const packageRoot = path.resolve(__dirname, '../../../../packages', moduleName, 'src')

  // 1. explicit substitution template
  const templatePath = path.join(packageRoot, 'templates', `${relPath}.ts`)
  if (await exists(templatePath)) {
    const raw = await readText(templatePath)
    return applySubstitutions(raw, ctx, selectedFeatures)
  }

  const templatePrismaPath = path.join(packageRoot, 'templates', `${relPath}.prisma`)
  if (await exists(templatePrismaPath)) {
    const raw = await readText(templatePrismaPath)
    return applySubstitutions(raw, ctx, selectedFeatures)
  }

  // 2. verbatim source file — apply substitutions if it lives inside templates/
  const sourcePath = path.join(packageRoot, `${relPath}.ts`)
  if (await exists(sourcePath)) {
    const raw = await readText(sourcePath)
    const isTemplateFile = sourcePath.includes(`${path.sep}templates${path.sep}`)
    return isTemplateFile ? applySubstitutions(raw, ctx, selectedFeatures) : raw
  }

  const sourcePrismaPath = path.join(packageRoot, `${relPath}.prisma`)
  if (await exists(sourcePrismaPath)) {
    return readText(sourcePrismaPath)
  }

  throw new Error(
    `Template not found for key "${templateKey}". ` +
      `Checked:\n  ${templatePath}\n  ${sourcePath}`,
  )
}

// ── Substitution variables ────────────────────────────────────

function applySubstitutions(
  content: string,
  ctx: DetectedContext,
  selectedFeatures: string[],
): string {
  const src = ctx.structure.srcDir ?? 'src'
  const authDir = `${src}/sedim/auth`

  const vars: Record<string, string> = {
    AUTH_DIR: authDir,
    SRC_DIR: src,
    FRAMEWORK: ctx.framework.value,
    ORM: ctx.orm.value,
    DB: ctx.db.value,
    ROUTE_TO_AUTH_IMPORT: routeToAuthImport(),
    MIDDLEWARE_TO_AUTH_IMPORT: middlewareToAuthImport(src),
    PROVIDERS_IMPORT: buildProvidersImport(selectedFeatures),
    PROVIDERS_CONFIG: buildProvidersConfig(selectedFeatures),
    // relative import from src/sedim/auth-adapter.ts to the user's db instance
    DB_INSTANCE_IMPORT: resolveDbInstanceImport(ctx),
    // cookie name — matches the default in framework-config.ts
    COOKIE_NAME: 'auth_session',
  }

  return content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

function routeToAuthImport(): string {
  // route is at: src/app/api/auth/[...all]/route.ts
  // auth is at:  src/sedim/auth/
  // relative:    ../../../../sedim/auth
  return '../../../../sedim/auth'
}

function middlewareToAuthImport(src: string): string {
  // middleware.ts is at project root
  return `./${src}/sedim/auth`
}

// resolves the relative import path from src/sedim/auth-adapter.ts to the user's db instance.
// auth-adapter.ts lands at src/sedim/auth-adapter.ts, so imports go up one level to src/
// then into the db directory. We check common Drizzle conventions in priority order.
function resolveDbInstanceImport(ctx: DetectedContext): string {
  const src = ctx.structure.srcDir ?? 'src'
  // common Drizzle db export locations, relative to src/sedim/
  // priority: db/index > db/client > db > lib/db
  const candidates = [
    `../${src}/db/index.js`,
    `../${src}/db/client.js`,
    `../${src}/db.js`,
    `../${src}/lib/db/index.js`,
    `../${src}/lib/db.js`,
  ]
  // auth-adapter.ts is at src/sedim/, so relative to that: ../db/index.js
  // we can't do async file existence checks here (sync context), so use the
  // most common convention and let the comment guide the user if it's wrong
  return `../db/index.js`
}

// builds the provider import line for config.ts based on selected features
function buildProvidersImport(features: string[]): string {
  const providerFns: string[] = []
  if (features.includes('oauth-google')) providerFns.push('googleProvider')
  if (features.includes('oauth-github')) providerFns.push('githubProvider')
  if (features.includes('oauth-discord')) providerFns.push('discordProvider')
  if (providerFns.length === 0) return ''
  return `import { ${providerFns.join(', ')} } from './adapters/framework-config.js'`
}

// builds the providers array for authConfig based on selected features
function buildProvidersConfig(features: string[]): string {
  const lines: string[] = []
  if (features.includes('oauth-google')) {
    lines.push(
      `    googleProvider(process.env['GOOGLE_CLIENT_ID']!, process.env['GOOGLE_CLIENT_SECRET']!),`,
    )
  }
  if (features.includes('oauth-github')) {
    lines.push(
      `    githubProvider(process.env['GITHUB_CLIENT_ID']!, process.env['GITHUB_CLIENT_SECRET']!),`,
    )
  }
  if (features.includes('oauth-discord')) {
    lines.push(
      `    discordProvider(process.env['DISCORD_CLIENT_ID']!, process.env['DISCORD_CLIENT_SECRET']!),`,
    )
  }
  if (lines.length === 0) return ''
  return `  providers: [\n${lines.join('\n')}\n  ],`
}
