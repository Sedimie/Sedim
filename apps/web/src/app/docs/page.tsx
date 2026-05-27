import '../../styles/globals.css'

function DocsNav() {
  return (
    <nav className="docs-nav">
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" className="docs-back">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Sedim
        </a>
        <a href="/docs" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>Docs</a>
      </div>
    </nav>
  )
}

function Sidebar() {
  return (
    <aside className="docs-sidebar">
      <h3>Getting Started</h3>
      <ul>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#quick-start">Quick start</a></li>
        <li><a href="#project-structure">What gets stamped</a></li>
      </ul>
      <h3>Features</h3>
      <ul>
        <li><a href="#feature-reference">Feature reference</a></li>
        <li><a href="#env-vars">Environment variables</a></li>
      </ul>
      <h3>Stacks</h3>
      <ul>
        <li><a href="#supported-stacks">Supported stacks</a></li>
      </ul>
      <h3>CLI</h3>
      <ul>
        <li><a href="#commands">Commands</a></li>
      </ul>
      <h3>Community</h3>
      <ul>
        <li><a href="https://github.com/Sedimie/Sedim/blob/main/CONTRIBUTING.md" target="_blank">Contributing guide</a></li>
        <li><a href="https://github.com/Sedimie/Sedim/issues" target="_blank">Issues</a></li>
        <li><a href="https://discord.com/invite/H7yutstM" target="_blank">Discord</a></li>
      </ul>
    </aside>
  )
}

function MainContent() {
  return (
    <main className="docs-main">
      <div className="docs-content">
        <h1>Documentation</h1>
        <p>Sedim is a CLI that stamps production-ready feature modules into your project. Every file it generates is yours to own, edit, and customize -- forever.</p>

        <h2 id="installation">Installation</h2>
        <p>Requires Node.js 18+ and pnpm 9+.</p>
        <pre><code>npm install -g @sedim/cli</code></pre>
        <p>Verify the installation:</p>
        <pre><code>sedim --version</code></pre>

        <h2 id="quick-start">Quick start</h2>
        <div className="callout">
          <p><strong>Prerequisite:</strong> You need an existing project with a supported framework (Next.js, Express, or Hono) and ORM (Drizzle or Prisma).</p>
        </div>

        <h3>Step 1 -- Initialize your project</h3>
        <pre><code>cd my-project
sedim init</code></pre>
        <p>Sedim auto-detects your framework, ORM, language, and writes a <code>sedim.config.ts</code> file. Edit it if anything is detected incorrectly.</p>

        <h3>Step 2 -- Add auth</h3>
        <pre><code>sedim add auth</code></pre>
        <p>The CLI walks you through:</p>
        <ul>
          <li>Feature selection -- email/password, OAuth providers, TOTP, magic links, JWT, RBAC/ABAC</li>
          <li>UI tier -- headless, Tailwind styled, or themed</li>
          <li>Plan review -- see exactly what will be written before anything stamps</li>
          <li>Environment variables -- add them on the spot or copy them to your <code>.env</code></li>
        </ul>

        <h3>Step 3 -- Migrate and run</h3>
        <pre><code># Drizzle
npx drizzle-kit push

# or Prisma
npx prisma migrate dev --name add_auth

# Then start your project
npm run dev</code></pre>

        <h2 id="project-structure">What gets stamped</h2>
        <p>Running <code>sedim add auth</code> generates this structure:</p>
        <pre><code>src/sedim/auth/
  core/
    hash-password.ts    -- Argon2id password hashing
    generate-token.ts   -- session tokens, OTP codes, backup codes, PKCE verifiers
    session.ts           -- sliding-window session validation
    pkce.ts              -- RFC 7636 PKCE S256
    totp.ts              -- RFC 6238 TOTP (Google Authenticator)
    totp-crypto.ts       -- AES-256-GCM encryption for TOTP secrets
    rate-limit.ts        -- sliding-window rate limiter
    rbac.ts              -- role-based access control
    abac.ts              -- attribute-based access control
    jwt.ts               -- hybrid JWT (short-lived + DB-backed refresh)
    email-transport.ts   -- nodemailer / resend / postmark / SES
  adapters/
    framework/
      nextjs.ts         -- Next.js App Router handler factory
      express.ts         -- Express router
      hono.ts            -- Hono route registration
      operations.ts      -- all auth operations
      framework-config.ts -- OAuth provider configuration
    drizzle.ts           -- Drizzle ORM adapter
    prisma.ts            -- Prisma ORM adapter
    types.ts             -- DatabaseAdapter interface
  ui/
    headless/            -- zero CSS, logic only
    tailwind/            -- Tailwind-styled components
    themed/              -- CSS token themes (minimal, colorful, glass)
  emails/
    email-verification.ts -- verification email template
  schema.ts              -- auto-generated schema for your ORM</code></pre>
        <p>Every stamped file is owned by you. Sedim uses <code>overwriteStrategy: skip</code> on core files -- it will never overwrite customizations you have made.</p>

        <h2 id="feature-reference">Feature reference</h2>
        <table className="feature-table">
          <thead>
            <tr><th>Feature</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Password auth</strong></td><td>Argon2id (OWASP params), account lockout after 10 failed attempts</td></tr>
            <tr><td><strong>Session management</strong></td><td>SHA-256 hashed tokens, httpOnly cookies, sliding-window validation, full revocation</td></tr>
            <tr><td><strong>OAuth</strong></td><td>Google, GitHub, Discord. PKCE S256 only (RFC 7636), no plain method</td></tr>
            <tr><td><strong>TOTP</strong></td><td>RFC 6238, Google Authenticator compatible, AES-256-GCM encrypted secrets, backup codes</td></tr>
            <tr><td><strong>Magic links</strong></td><td>Non-enumerating (always returns success), SMTP / Resend / Postmark / SES</td></tr>
            <tr><td><strong>JWT</strong></td><td>Hybrid: short-lived signed JWTs + DB-backed refresh tokens</td></tr>
            <tr><td><strong>RBAC</strong></td><td>Role definitions with hasPermission / requireRole middleware factories</td></tr>
            <tr><td><strong>ABAC</strong></td><td>Attribute-based policy engine for fine-grained access control</td></tr>
            <tr><td><strong>Rate limiting</strong></td><td>Sliding-window, inline in every operation. In-memory by default, Redis-ready via interface</td></tr>
          </tbody>
        </table>

        <h2 id="env-vars">Environment variables</h2>
        <pre><code># Required
AUTH_SECRET=                    -- min 32 chars, used for session signing
DATABASE_URL=                  -- your database connection string

# OAuth -- add only the providers you selected
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Email -- add only the provider you selected
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
RESEND_API_KEY=
POSTMARK_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SES_REGION=

# Optional
REDIS_URL=                     -- rate limiting and session storage
TOTP_ENCRYPTION_KEY=            -- required when TOTP is enabled, 32-byte hex</code></pre>

        <h2 id="supported-stacks">Supported stacks</h2>
        <table className="feature-table">
          <thead>
            <tr><th>Framework</th><th>Drizzle</th><th>Prisma</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Next.js (App Router)</strong></td><td>Supported</td><td>Supported</td></tr>
            <tr><td><strong>Express</strong></td><td>Supported</td><td>Supported</td></tr>
            <tr><td><strong>Hono</strong></td><td>Supported</td><td>Supported</td></tr>
          </tbody>
        </table>
        <p>Email providers: Nodemailer (SMTP), Resend, Postmark, AWS SES.</p>

        <h2 id="commands">CLI reference</h2>
        <table className="feature-table">
          <thead>
            <tr><th>Command</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>sedim init</code></td><td>Detect stack and create sedim.config.ts</td></tr>
            <tr><td><code>sedim add auth</code></td><td>Add auth module to your project</td></tr>
            <tr><td><code>sedim plan</code></td><td>Preview what would be stamped (without writing)</td></tr>
            <tr><td><code>sedim diff</code></td><td>Show file-level diff of what would change</td></tr>
            <tr><td><code>sedim doctor</code></td><td>Check your environment for issues</td></tr>
            <tr><td><code>sedim --help</code></td><td>Show all available commands</td></tr>
          </tbody>
        </table>
        <div className="callout">
          <p><strong>Tip:</strong> Use <code>--dry-run</code> with any write command to preview the plan without committing any files.</p>
        </div>
      </div>
    </main>
  )
}

function DocsFooter() {
  return (
    <div className="docs-footer">
      <h3>Links</h3>
      <a href="https://github.com/Sedimie/Sedim" target="_blank">GitHub</a>
      <a href="https://discord.com/invite/H7yutstM" target="_blank">Discord</a>
      <a href="https://github.com/Sedimie/Sedim/issues" target="_blank">Issues</a>
      <a href="https://github.com/Sedimie/Sedim/blob/main/CONTRIBUTING.md" target="_blank">Contributing</a>
    </div>
  )
}

function Footer() {
  return (
    <footer>
      <div className="container footer-inner">
        <div className="footer-copy">2026 Sedim -- MIT License</div>
        <div className="footer-links">
          <a href="/docs">Docs</a>
          <a href="https://github.com/Sedimie/Sedim" target="_blank">GitHub</a>
          <a href="https://discord.com/invite/H7yutstM" target="_blank">Discord</a>
        </div>
      </div>
    </footer>
  )
}

export default function DocsPage() {
  return (
    <>
      <DocsNav />
      <div className="docs-layout">
        <Sidebar />
        <MainContent />
        <DocsFooter />
      </div>
      <Footer />
    </>
  )
}