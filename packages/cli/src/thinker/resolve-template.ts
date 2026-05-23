import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'fs'
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

// projectRoot is passed via ctx.structure. It is validated against sedim.config.ts
// so it's a reliable anchor. We go 2 levels up from projectRoot to reach monorepo root,
// then into packages/<module>/src.
function getPackageRoot(projectRoot: string, moduleName: string): string {
  // projectRoot → monorepo root (3 levels up from project root)
  // then packages/<module>/src
  return path.resolve(projectRoot, '..', '..', '..', 'packages', moduleName, 'src')
}

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

  // Use projectRoot as anchor — it's validated and doesn't depend on __dirname
  const projectRoot = ctx.projectRoot ?? process.cwd()
  const packageRoot = getPackageRoot(projectRoot, moduleName)

  // Fallback to __dirname-based resolution for older callers that don't have projectRoot
  // This handles cases where ctx isn't fully populated
  const tryPackageRoot = (levels: string) =>
    path.resolve(__dirname, levels, 'packages', moduleName, 'src')
  const packageRoot3 = tryPackageRoot('../../..')
  const packageRoot4 = tryPackageRoot('../../../../..')
  // Use projectRoot-based path if it exists, otherwise try __dirname paths
  const resolvedRoot = existsSync(packageRoot)
    ? packageRoot
    : existsSync(packageRoot3)
      ? packageRoot3
      : existsSync(packageRoot4)
        ? packageRoot4
        : packageRoot

  // ── Special case: generated page content ─────────────────
  // These keys produce fully generated content — no source file needed.
  const generatedKeys: Record<string, (f: string[], c: DetectedContext) => string> = {
    'ui/pages/login-page': f => buildLoginPage(f),
    'ui/pages/signup-page': f => buildSignupPage(f),
    'ui/pages/forgot-password-page': f => buildForgotPage(f),
    'ui/pages/reset-password-page': f => buildResetPage(f),
    'db/client': (_f, c) => buildDbClientFile(c),
  }
  if (generatedKeys[relPath]) {
    return generatedKeys[relPath](selectedFeatures, ctx)
  }

  let content: string

  // 1. explicit substitution template
  const templatePath = path.join(resolvedRoot, 'templates', `${relPath}.ts`)
  if (await exists(templatePath)) {
    const raw = await readText(templatePath)
    content = applySubstitutions(raw, ctx, selectedFeatures)
  } else {
    const templatePrismaPath = path.join(resolvedRoot, 'templates', `${relPath}.prisma`)
    if (await exists(templatePrismaPath)) {
      const raw = await readText(templatePrismaPath)
      content = applySubstitutions(raw, ctx, selectedFeatures)
    } else {
      // 2. verbatim source file
      const knownExts = ['.ts', '.tsx', '.css', '.prisma']
      const hasExt = knownExts.some(e => relPath.endsWith(e))

      if (hasExt) {
        const sourcePath = path.join(resolvedRoot, relPath)
        if (await exists(sourcePath)) {
          content = await readText(sourcePath)
          // Apply substitutions to all source files — they may contain
          // {{VAR}} placeholders that need resolving (e.g. API_BASE_PATH).
          content = applySubstitutions(content, ctx, selectedFeatures)
        } else {
          content = ''
        }
      } else {
        let found = false
        content = ''
        for (const ext of ['.ts', '.tsx', '.css']) {
          const sourcePath = path.join(resolvedRoot, `${relPath}${ext}`)
          if (await exists(sourcePath)) {
            const raw = await readText(sourcePath)
            content = applySubstitutions(raw, ctx, selectedFeatures)
            found = true
            break
          }
        }
        if (!found) {
          const sourcePrismaPath = path.join(resolvedRoot, `${relPath}.prisma`)
          if (await exists(sourcePrismaPath)) {
            content = await readText(sourcePrismaPath)
          } else {
            throw new Error(
              `Template not found for key "${templateKey}". ` +
                `Checked:\n  ${templatePath}\n  ${path.join(resolvedRoot, relPath)}.[ts|tsx|css]`,
            )
          }
        }
      }
    }
  }

  // ── Strip .js extensions from relative imports ────────────
  // Next.js (Turbopack/webpack) and other bundlers resolve imports
  // literally — they won't map './foo.js' to './foo.ts'.
  // Node ESM needs .js extensions; bundlers don't. Since stamped files
  // live inside a bundler project, strip them.
  // Only strip from relative imports (starting with ./ or ../) to avoid
  // touching third-party package imports like 'drizzle-orm/neon-http'.
  if (!relPath.endsWith('.css') && !relPath.endsWith('.prisma')) {
    content = stripRelativeJsExtensions(content)
  }

  return content
}

// ── Substitution variables ────────────────────────────────────

// Strips .js extensions from relative imports so bundlers (Next.js Turbopack,
// Vite, webpack) can resolve them. Only touches imports starting with ./ or ../
// to avoid breaking third-party package imports like 'drizzle-orm/neon-http'.
function stripRelativeJsExtensions(content: string): string {
  return content.replace(/(from\s+['"])(\.\.?\/[^'"]*?)\.js(['"])/g, '$1$2$3')
}

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
    FORGOT_PAGE: buildForgotPage(selectedFeatures),
    RESET_PAGE: buildResetPage(selectedFeatures),
    // API base path — /api/auth for Next.js, /auth for Express/Hono
    API_BASE_PATH: buildApiBasePath(ctx),
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
  const isThemed = features.includes('themed')
  const themeVariant = features.find(f => ['modern', 'minimal', 'colorful'].includes(f)) ?? 'modern'

  const borderColor = isThemed ? 'var(--auth-border)' : '#e5e7eb'
  const mutedColor = isThemed ? 'var(--auth-muted)' : '#6b7280'
  const fgColor = isThemed ? 'var(--auth-fg)' : 'inherit'

  const imports: string[] = ["'use client'", '']
  if (hasPassword) imports.push(`import { LoginForm } from '@/sedim/auth/ui/LoginForm'`)
  if (hasMagicLink) imports.push(`import { MagicLinkForm } from '@/sedim/auth/ui/MagicLinkForm'`)
  if (hasOAuth) imports.push(`import { OAuthButton } from '@/sedim/auth/ui/OAuthButton'`)

  const divider = [
    `      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>`,
    `        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid ${borderColor}', margin: 0 }} />`,
    `        <span style={{ color: '${mutedColor}', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>or</span>`,
    `        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid ${borderColor}', margin: 0 }} />`,
    `      </div>`,
  ].join('\n')

  const body: string[] = []

  if (hasOAuth) {
    body.push(`      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>`)
    for (const p of oauthProviders) {
      body.push(`        <OAuthButton provider="${p}" />`)
    }
    body.push(`      </div>`)
  }

  if (hasOAuth && (hasPassword || hasMagicLink)) body.push(divider)
  if (hasPassword) body.push(`      <LoginForm redirectTo="/dashboard" />`)
  if (hasMagicLink) {
    if (hasPassword) body.push(divider)
    body.push(`      <MagicLinkForm />`)
  }

  if (hasPassword) {
    body.push(
      `      <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '${mutedColor}', margin: 0 }}>`,
    )
    body.push(
      `        Don&apos;t have an account?{' '}<a href="/signup" style={{ color: '${fgColor}', fontWeight: 600, textDecoration: 'none' }}>Sign up</a>`,
    )
    body.push(`      </p>`)
  }

  if (!isThemed) {
    return [
      ...imports,
      '',
      `// src/app/login/page.tsx — edit freely`,
      `export default function LoginPage() {`,
      `  return (`,
      `    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>`,
      `      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>`,
      `        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', margin: 0 }}>Sign in</h1>`,
      ...body,
      `      </div>`,
      `    </main>`,
      `  )`,
      `}`,
    ].join('\n')
  }

  // themed — modern gets a split layout, others get centered card
  if (themeVariant === 'modern') {
    return [
      ...imports,
      '',
      `// src/app/login/page.tsx — edit freely`,
      `export default function LoginPage() {`,
      `  return (`,
      `    <main className="sedim-auth-page" style={{ display: 'flex', minHeight: '100vh' }}>`,
      `      {/* Left panel — form */}`,
      `      <div style={{ flex: '0 0 480px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem', gap: '2rem' }}>`,
      `        <div>`,
      `          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--auth-fg)', margin: '0 0 0.375rem' }}>Welcome back</h1>`,
      `          <p style={{ color: 'var(--auth-muted)', fontSize: '0.9375rem', margin: 0 }}>Sign in to continue</p>`,
      `        </div>`,
      `        <div className="sedim-auth-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>`,
      ...body.map(l => '  ' + l),
      `        </div>`,
      `      </div>`,
      `      {/* Right panel — decorative, replace with your own image */}`,
      `      <div style={{ flex: 1, background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>`,
      `        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }} />`,
      `      </div>`,
      `    </main>`,
      `  )`,
      `}`,
    ].join('\n')
  }

  // minimal / colorful — centered card
  return [
    ...imports,
    '',
    `// src/app/login/page.tsx — edit freely`,
    `export default function LoginPage() {`,
    `  return (`,
    `    <main className="sedim-auth-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>`,
    `      <div className="sedim-auth-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>`,
    `        <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>`,
    `          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--auth-fg)', margin: '0 0 0.25rem' }}>Welcome back</h1>`,
    `          <p style={{ color: 'var(--auth-muted)', fontSize: '0.875rem', margin: 0 }}>Sign in to continue</p>`,
    `        </div>`,
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
  const isThemed = features.includes('themed')
  const themeVariant = features.find(f => ['modern', 'minimal', 'colorful'].includes(f)) ?? 'modern'

  const borderColor = isThemed ? 'var(--auth-border)' : '#e5e7eb'
  const mutedColor = isThemed ? 'var(--auth-muted)' : '#6b7280'
  const fgColor = isThemed ? 'var(--auth-fg)' : 'inherit'

  const imports: string[] = ["'use client'", '']
  if (hasPassword) imports.push(`import { SignupForm } from '@/sedim/auth/ui/SignupForm'`)
  if (hasOAuth) imports.push(`import { OAuthButton } from '@/sedim/auth/ui/OAuthButton'`)

  const divider = [
    `      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>`,
    `        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid ${borderColor}', margin: 0 }} />`,
    `        <span style={{ color: '${mutedColor}', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>or</span>`,
    `        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid ${borderColor}', margin: 0 }} />`,
    `      </div>`,
  ].join('\n')

  const body: string[] = []
  if (hasOAuth) {
    body.push(`      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>`)
    for (const p of oauthProviders) body.push(`        <OAuthButton provider="${p}" />`)
    body.push(`      </div>`)
  }
  if (hasOAuth && hasPassword) body.push(divider)
  if (hasPassword) body.push(`      <SignupForm redirectTo="/dashboard" />`)
  body.push(
    `      <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '${mutedColor}', margin: 0 }}>`,
  )
  body.push(
    `        Already have an account?{' '}<a href="/login" style={{ color: '${fgColor}', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>`,
  )
  body.push(`      </p>`)

  if (!isThemed) {
    return [
      ...imports,
      '',
      `export default function SignupPage() {`,
      `  return (`,
      `    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>`,
      `      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>`,
      `        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', margin: 0 }}>Create account</h1>`,
      ...body,
      `      </div>`,
      `    </main>`,
      `  )`,
      `}`,
    ].join('\n')
  }

  if (themeVariant === 'modern') {
    return [
      ...imports,
      '',
      `export default function SignupPage() {`,
      `  return (`,
      `    <main className="sedim-auth-page" style={{ display: 'flex', minHeight: '100vh' }}>`,
      `      <div style={{ flex: '0 0 480px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem', gap: '2rem' }}>`,
      `        <div>`,
      `          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--auth-fg)', margin: '0 0 0.375rem' }}>Create account</h1>`,
      `          <p style={{ color: 'var(--auth-muted)', fontSize: '0.9375rem', margin: 0 }}>Get started for free</p>`,
      `        </div>`,
      `        <div className="sedim-auth-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>`,
      ...body.map(l => '  ' + l),
      `        </div>`,
      `      </div>`,
      `      <div style={{ flex: 1, background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #7c3aed 100%)' }} />`,
      `    </main>`,
      `  )`,
      `}`,
    ].join('\n')
  }

  return [
    ...imports,
    '',
    `export default function SignupPage() {`,
    `  return (`,
    `    <main className="sedim-auth-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>`,
    `      <div className="sedim-auth-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>`,
    `        <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>`,
    `          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--auth-fg)', margin: '0 0 0.25rem' }}>Create account</h1>`,
    `          <p style={{ color: 'var(--auth-muted)', fontSize: '0.875rem', margin: 0 }}>Get started for free</p>`,
    `        </div>`,
    ...body,
    `      </div>`,
    `    </main>`,
    `  )`,
    `}`,
  ].join('\n')
}

function buildForgotPage(features: string[] = []): string {
  const isThemed = features.includes('themed')
  const themeVariant = features.find(f => ['modern', 'minimal', 'colorful'].includes(f)) ?? 'modern'
  const mutedColor = isThemed ? 'var(--auth-muted)' : '#6b7280'
  const fgColor = isThemed ? 'var(--auth-fg)' : '#6b7280'

  const inner = [
    `        <div style={{ textAlign: 'center' }}>`,
    `          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' }}>Reset password</h1>`,
    `          <p style={{ fontSize: '0.875rem', color: '${mutedColor}', margin: 0 }}>Enter your email and we&apos;ll send a reset link.</p>`,
    `        </div>`,
    `        <ForgotPasswordForm />`,
    `        <p style={{ textAlign: 'center', fontSize: '0.8125rem', margin: 0 }}>`,
    `          <a href="/login" style={{ color: '${fgColor}', textDecoration: 'none', fontWeight: 500 }}>Back to sign in</a>`,
    `        </p>`,
  ].join('\n')

  if (!isThemed || themeVariant === 'modern') {
    const wrapper = isThemed
      ? `    <main className="sedim-auth-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>`
      : `    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>`
    const card = isThemed
      ? `      <div className="sedim-auth-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>`
      : `      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>`
    return [
      `'use client'`,
      ``,
      `import { ForgotPasswordForm } from '@/sedim/auth/ui/ForgotPasswordForm'`,
      ``,
      `export default function ForgotPasswordPage() {`,
      `  return (`,
      wrapper,
      card,
      inner,
      `      </div>`,
      `    </main>`,
      `  )`,
      `}`,
    ].join('\n')
  }

  return [
    `'use client'`,
    ``,
    `import { ForgotPasswordForm } from '@/sedim/auth/ui/ForgotPasswordForm'`,
    ``,
    `export default function ForgotPasswordPage() {`,
    `  return (`,
    `    <main className="sedim-auth-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>`,
    `      <div className="sedim-auth-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>`,
    inner,
    `      </div>`,
    `    </main>`,
    `  )`,
    `}`,
  ].join('\n')
}

function buildResetPage(features: string[] = []): string {
  const isThemed = features.includes('themed')
  const wrapper = isThemed
    ? `    <main className="sedim-auth-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>`
    : `    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>`
  const card = isThemed
    ? `      <div className="sedim-auth-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>`
    : `      <div style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>`

  return [
    `'use client'`,
    ``,
    `import { ResetPasswordForm } from '@/sedim/auth/ui/ResetPasswordForm'`,
    ``,
    `// The token is read from the URL query param automatically by ResetPasswordForm.`,
    `export default function ResetPasswordPage() {`,
    `  return (`,
    wrapper,
    card,
    `        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', margin: 0 }}>Set new password</h1>`,
    `        <ResetPasswordForm redirectTo="/login" />`,
    `      </div>`,
    `    </main>`,
    `  )`,
    `}`,
  ].join('\n')
}

// ── API base path builder ────────────────────────────────────────
// Determines the API base path for the auth-client.ts template.
// Next.js: /api/auth (uses NEXT_PUBLIC_API_URL env var)
// Express/Hono: /auth (uses VITE_API_URL env var)

function buildApiBasePath(ctx: DetectedContext): string {
  if (ctx.framework.value === 'nextjs') {
    return '/api/auth'
  }
  return '/auth'
}

// ── DB client file generator ──────────────────────────────────
// Generates src/db/index.ts wired to the correct driver.
// Detects the driver from the project's package.json dependencies.
// The user just needs to set DATABASE_URL in .env — nothing else.

function buildDbClientFile(ctx: DetectedContext): string {
  const db = ctx.db.value

  // detect specific driver from evidence strings — the detector records
  // which package it found as evidence, e.g. '"@neondatabase/serverless" in dependencies'
  const evidence = ctx.db.evidence?.join(' ') ?? ''

  if (db === 'postgres') {
    if (evidence.includes('@neondatabase/serverless')) {
      return [
        `// src/db/index.ts`,
        `// Drizzle client — Neon serverless postgres`,
        `// Generated by sedim. Edit freely.`,
        `import { neon } from '@neondatabase/serverless'`,
        `import { drizzle } from 'drizzle-orm/neon-http'`,
        ``,
        `const sql = neon(process.env['DATABASE_URL']!)`,
        `export const db = drizzle(sql)`,
      ].join('\n')
    }
    if (evidence.includes('@vercel/postgres')) {
      return [
        `// src/db/index.ts`,
        `// Drizzle client — Vercel postgres`,
        `import { sql } from '@vercel/postgres'`,
        `import { drizzle } from 'drizzle-orm/vercel-postgres'`,
        ``,
        `export const db = drizzle(sql)`,
      ].join('\n')
    }
    // generic pg fallback
    return [
      `// src/db/index.ts`,
      `// Drizzle client — node-postgres`,
      `import { Pool } from 'pg'`,
      `import { drizzle } from 'drizzle-orm/node-postgres'`,
      ``,
      `const pool = new Pool({ connectionString: process.env['DATABASE_URL']! })`,
      `export const db = drizzle(pool)`,
    ].join('\n')
  }

  if (db === 'mysql') {
    if (evidence.includes('@planetscale/database')) {
      return [
        `// src/db/index.ts`,
        `// Drizzle client — PlanetScale`,
        `import { connect } from '@planetscale/database'`,
        `import { drizzle } from 'drizzle-orm/planetscale-serverless'`,
        ``,
        `const connection = connect({ url: process.env['DATABASE_URL']! })`,
        `export const db = drizzle(connection)`,
      ].join('\n')
    }
    return [
      `// src/db/index.ts`,
      `// Drizzle client — mysql2`,
      `import mysql from 'mysql2/promise'`,
      `import { drizzle } from 'drizzle-orm/mysql2'`,
      ``,
      `const connection = await mysql.createConnection(process.env['DATABASE_URL']!)`,
      `export const db = drizzle(connection)`,
    ].join('\n')
  }

  if (db === 'sqlite') {
    if (evidence.includes('@libsql/client')) {
      return [
        `// src/db/index.ts`,
        `// Drizzle client — Turso / libSQL`,
        `import { createClient } from '@libsql/client'`,
        `import { drizzle } from 'drizzle-orm/libsql'`,
        ``,
        `const client = createClient({ url: process.env['DATABASE_URL']! })`,
        `export const db = drizzle(client)`,
      ].join('\n')
    }
    return [
      `// src/db/index.ts`,
      `// Drizzle client — better-sqlite3`,
      `import Database from 'better-sqlite3'`,
      `import { drizzle } from 'drizzle-orm/better-sqlite3'`,
      ``,
      `const sqlite = new Database(process.env['DATABASE_URL'] ?? 'local.db')`,
      `export const db = drizzle(sqlite)`,
    ].join('\n')
  }

  // unknown — generic stub with a comment
  return [
    `// src/db/index.ts`,
    `// Drizzle client — configure this for your database driver`,
    `// See: https://orm.drizzle.team/docs/get-started`,
    `import { drizzle } from 'drizzle-orm/node-postgres'`,
    ``,
    `// Replace with your actual driver setup`,
    `export const db = drizzle(process.env['DATABASE_URL']!)`,
  ].join('\n')
}
