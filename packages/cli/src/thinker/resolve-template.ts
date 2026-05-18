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

  // ── Special case: generated page content ─────────────────
  // These keys produce fully generated content — no source file needed.
  const generatedKeys: Record<string, (f: string[], c: DetectedContext) => string> = {
    'ui/pages/login-page': f => buildLoginPage(f),
    'ui/pages/signup-page': f => buildSignupPage(f),
    'ui/pages/forgot-password-page': () => buildForgotPage(),
    'ui/pages/reset-password-page': () => buildResetPage(),
  }
  if (generatedKeys[relPath]) {
    return generatedKeys[relPath](selectedFeatures, ctx)
  }

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
  // if relPath already has a file extension, try it directly first
  const knownExts = ['.ts', '.tsx', '.css', '.prisma']
  const hasExt = knownExts.some(e => relPath.endsWith(e))

  if (hasExt) {
    const sourcePath = path.join(packageRoot, relPath)
    if (await exists(sourcePath)) {
      return readText(sourcePath)
    }
  }

  // otherwise try appending each extension
  for (const ext of ['.ts', '.tsx', '.css']) {
    const sourcePath = path.join(packageRoot, `${relPath}${ext}`)
    if (await exists(sourcePath)) {
      const raw = await readText(sourcePath)
      const isTemplateFile = sourcePath.includes(`${path.sep}templates${path.sep}`)
      return isTemplateFile ? applySubstitutions(raw, ctx, selectedFeatures) : raw
    }
  }

  const sourcePrismaPath = path.join(packageRoot, `${relPath}.prisma`)
  if (await exists(sourcePrismaPath)) {
    return readText(sourcePrismaPath)
  }

  throw new Error(
    `Template not found for key "${templateKey}". ` +
      `Checked:\n  ${templatePath}\n  ${path.join(packageRoot, relPath)}.[ts|tsx|css]`,
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
    // conditional UI component exports for the barrel index
    UI_EXPORTS: buildUiExports(selectedFeatures),
    // page content — generated based on selected features
    LOGIN_PAGE: buildLoginPage(selectedFeatures),
    SIGNUP_PAGE: buildSignupPage(selectedFeatures),
    FORGOT_PAGE: buildForgotPage(),
    RESET_PAGE: buildResetPage(),
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

// builds conditional UI component exports for the barrel index
function buildUiExports(features: string[]): string {
  const lines: string[] = []
  if (features.includes('email-password')) {
    lines.push(`export { LoginForm } from './ui/LoginForm.js'`)
    lines.push(`export { SignupForm } from './ui/SignupForm.js'`)
    lines.push(`export { ForgotPasswordForm } from './ui/ForgotPasswordForm.js'`)
    lines.push(`export { ResetPasswordForm } from './ui/ResetPasswordForm.js'`)
  }
  if (features.includes('magic-link')) {
    lines.push(`export { MagicLinkForm } from './ui/MagicLinkForm.js'`)
  }
  if (features.some(f => f.startsWith('oauth-'))) {
    lines.push(`export { OAuthButton } from './ui/OAuthButton.js'`)
  }
  if (features.includes('totp')) {
    lines.push(`export { TotpVerifyForm } from './ui/TotpVerifyForm.js'`)
  }
  return lines.length > 0 ? lines.join('\n') : ''
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

// ── Page builders ─────────────────────────────────────────────
// Generate full Next.js page files based on selected features.
// These are the actual pages the user navigates to — /login, /signup, etc.

function buildLoginPage(features: string[]): string {
  const hasPassword = features.includes('email-password')
  const hasMagicLink = features.includes('magic-link')
  const oauthProviders = features
    .filter(f => f.startsWith('oauth-'))
    .map(f => f.replace('oauth-', '')) as string[]
  const hasOAuth = oauthProviders.length > 0

  const imports: string[] = ["'use client'", '']
  if (hasPassword) imports.push(`import { LoginForm } from '@/sedim/auth/ui/LoginForm'`)
  if (hasMagicLink) imports.push(`import { MagicLinkForm } from '@/sedim/auth/ui/MagicLinkForm'`)
  if (hasOAuth) imports.push(`import { OAuthButton } from '@/sedim/auth/ui/OAuthButton'`)

  const body: string[] = []

  if (hasPassword) {
    body.push(`      <LoginForm redirectTo="/dashboard" />`)
  }

  if (hasOAuth && (hasPassword || hasMagicLink)) {
    body.push(
      `      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>`,
    )
    body.push(
      `        <hr style={{ flex: 1 }} /><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>or</span><hr style={{ flex: 1 }} />`,
    )
    body.push(`      </div>`)
  }

  if (hasOAuth) {
    body.push(`      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>`)
    for (const p of oauthProviders) {
      body.push(`        <OAuthButton provider="${p}" />`)
    }
    body.push(`      </div>`)
  }

  if (hasMagicLink) {
    if (hasPassword || hasOAuth) {
      body.push(
        `      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>`,
      )
      body.push(
        `        <hr style={{ flex: 1 }} /><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>or</span><hr style={{ flex: 1 }} />`,
      )
      body.push(`      </div>`)
    }
    body.push(`      <MagicLinkForm />`)
  }

  if (hasPassword) {
    body.push(`      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>`)
    body.push(
      `        Don&apos;t have an account? <a href="/signup" style={{ color: 'inherit', fontWeight: 500 }}>Sign up</a>`,
    )
    body.push(`      </p>`)
    body.push(`      <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>`)
    body.push(
      `        <a href="/forgot-password" style={{ color: '#6b7280' }}>Forgot password?</a>`,
    )
    body.push(`      </p>`)
  }

  return [
    ...imports,
    '',
    `// src/app/login/page.tsx`,
    `// Edit this file to customise the login page layout.`,
    `// The form components are in src/sedim/auth/ui/`,
    `export default function LoginPage() {`,
    `  return (`,
    `    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>`,
    `      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>`,
    `        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', margin: '0 0 1rem' }}>Sign in</h1>`,
    ...body,
    `      </div>`,
    `    </main>`,
    `  )`,
    `}`,
  ].join('\n')
}

function buildSignupPage(features: string[]): string {
  const hasPassword = features.includes('email-password')
  const oauthProviders = features
    .filter(f => f.startsWith('oauth-'))
    .map(f => f.replace('oauth-', ''))
  const hasOAuth = oauthProviders.length > 0

  const imports: string[] = ["'use client'", '']
  if (hasPassword) imports.push(`import { SignupForm } from '@/sedim/auth/ui/SignupForm'`)
  if (hasOAuth) imports.push(`import { OAuthButton } from '@/sedim/auth/ui/OAuthButton'`)

  const body: string[] = []

  if (hasPassword) body.push(`      <SignupForm redirectTo="/dashboard" />`)

  if (hasOAuth && hasPassword) {
    body.push(
      `      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>`,
    )
    body.push(
      `        <hr style={{ flex: 1 }} /><span style={{ color: '#6b7280', fontSize: '0.875rem' }}>or</span><hr style={{ flex: 1 }} />`,
    )
    body.push(`      </div>`)
  }

  if (hasOAuth) {
    body.push(`      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>`)
    for (const p of oauthProviders) {
      body.push(`        <OAuthButton provider="${p}" />`)
    }
    body.push(`      </div>`)
  }

  body.push(`      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>`)
  body.push(
    `        Already have an account? <a href="/login" style={{ color: 'inherit', fontWeight: 500 }}>Sign in</a>`,
  )
  body.push(`      </p>`)

  return [
    ...imports,
    '',
    `// src/app/signup/page.tsx`,
    `export default function SignupPage() {`,
    `  return (`,
    `    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>`,
    `      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>`,
    `        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', margin: '0 0 1rem' }}>Create account</h1>`,
    ...body,
    `      </div>`,
    `    </main>`,
    `  )`,
    `}`,
  ].join('\n')
}

function buildForgotPage(): string {
  return [
    `'use client'`,
    ``,
    `import { ForgotPasswordForm } from '@/sedim/auth/ui/ForgotPasswordForm'`,
    ``,
    `// src/app/forgot-password/page.tsx`,
    `export default function ForgotPasswordPage() {`,
    `  return (`,
    `    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>`,
    `      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>`,
    `        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', margin: '0 0 0.5rem' }}>Reset password</h1>`,
    `        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1rem' }}>`,
    `          Enter your email and we&apos;ll send you a reset link.`,
    `        </p>`,
    `        <ForgotPasswordForm />`,
    `        <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>`,
    `          <a href="/login" style={{ color: '#6b7280' }}>Back to sign in</a>`,
    `        </p>`,
    `      </div>`,
    `    </main>`,
    `  )`,
    `}`,
  ].join('\n')
}

function buildResetPage(): string {
  return [
    `'use client'`,
    ``,
    `import { ResetPasswordForm } from '@/sedim/auth/ui/ResetPasswordForm'`,
    ``,
    `// src/app/reset-password/page.tsx`,
    `// The token is read from the URL query param automatically by ResetPasswordForm.`,
    `export default function ResetPasswordPage() {`,
    `  return (`,
    `    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>`,
    `      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>`,
    `        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', margin: '0 0 1rem' }}>Set new password</h1>`,
    `        <ResetPasswordForm redirectTo="/login" />`,
    `      </div>`,
    `    </main>`,
    `  )`,
    `}`,
  ].join('\n')
}
