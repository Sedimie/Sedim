import Link from 'next/link'

export const metadata = {
  title: 'Documentation',
}

export default function DocsPage() {
  return (
    <>
      <p className="docs-eyebrow">Getting started</p>
      <h1 className="docs-title">Welcome to sedim</h1>
      <p className="docs-lead">
        Sedim is a CLI that stamps production-ready, fully-wired modules - frontend, backend, and
        schema - directly into your codebase. Every file it generates is yours to own, edit, and
        customize forever.
      </p>

      <div className="docs-content">
        <h2 id="overview">What sedim does, in one paragraph</h2>
        <p>
          Run <code>sedim init</code> once to let the Detector learn your stack. Then{' '}
          <code>sedim add &lt;module&gt;</code> triggers a four-part pipeline -{' '}
          <strong>Detector → Thinker → Showbaby → Writer</strong> - that plans the change, shows
          you the diff, and stamps only what you need. Core logic files use{' '}
          <code>overwriteStrategy: skip</code>, so your customizations are never overwritten.
        </p>

        <h2 id="read-next">Read next</h2>
        <div className="docs-cards">
          <Link href="/docs#quickstart" className="docs-card">
            <span className="docs-card-dot" aria-hidden="true" />
            <div>
              <div className="docs-card-title">Quickstart</div>
              <p className="docs-card-desc">
                Install, init, add your first module in under two minutes.
              </p>
            </div>
          </Link>
          <Link href="/docs#configuration" className="docs-card">
            <span className="docs-card-dot" aria-hidden="true" />
            <div>
              <div className="docs-card-title">Configuration</div>
              <p className="docs-card-desc">
                What lives in <code>sedim.config.ts</code> and how to edit it.
              </p>
            </div>
          </Link>
          <Link href="/docs/commands/init" className="docs-card">
            <span className="docs-card-dot" aria-hidden="true" />
            <div>
              <div className="docs-card-title">sedim init</div>
              <p className="docs-card-desc">How the Detector bootstraps your project.</p>
            </div>
          </Link>
          <Link href="/docs#pipeline" className="docs-card">
            <span className="docs-card-dot" aria-hidden="true" />
            <div>
              <div className="docs-card-title">Pipeline overview</div>
              <p className="docs-card-desc">
                How Detector → Thinker → Showbaby → Writer fit together.
              </p>
            </div>
          </Link>
        </div>

        <h2 id="quickstart">Quickstart</h2>
        <div className="docs-callout">
          <strong>Prerequisite:</strong> Node.js 18+, an existing project with a supported framework
          (Next.js, Express, or Hono) and ORM (Drizzle or Prisma).
        </div>

        <h3>1. Install the CLI</h3>
        <pre>
          <code>{`npm install -g @sedim/cli\nsedim --version`}</code>
        </pre>

        <h3>2. Initialize your project</h3>
        <pre>
          <code>{`cd my-project\nsedim init`}</code>
        </pre>
        <p>
          Sedim auto-detects your framework, ORM, and language, then writes{' '}
          <code>sedim.config.ts</code>. Edit it directly if anything is detected incorrectly.
        </p>

        <h3>3. Add auth</h3>
        <pre>
          <code>sedim add auth</code>
        </pre>
        <p>The CLI walks you through:</p>
        <ul>
          <li>Feature selection - email/password, OAuth, TOTP, magic links, JWT, RBAC/ABAC</li>
          <li>UI tier - headless, Tailwind styled, or themed with CSS tokens</li>
          <li>Plan review - see exactly what will be written before anything stamps</li>
          <li>Environment variables - add them on the spot or copy to your <code>.env</code></li>
        </ul>

        <h3>4. Migrate and run</h3>
        <pre>
          <code>{`# Drizzle\nnpx drizzle-kit push\n\n# or Prisma\nnpx prisma migrate dev --name add_auth\n\nnpm run dev`}</code>
        </pre>

        <h2 id="configuration">Configuration</h2>
        <p>
          After <code>sedim init</code>, a <code>sedim.config.ts</code> file is written to your
          project root. It stores detected facts about your stack:
        </p>
        <ul>
          <li>
            <code>framework</code> - nextjs, express, or hono
          </li>
          <li>
            <code>orm</code> - drizzle or prisma
          </li>
          <li>
            <code>language</code> - typescript or javascript
          </li>
          <li>
            <code>db</code> - postgresql, mysql, sqlite, etc.
          </li>
        </ul>
        <p>
          Re-run <code>sedim init --force</code> to regenerate from scratch, or edit the file
          directly to override detection.
        </p>

        <h2 id="commands">Commands</h2>

        <h3 id="sedim-init">sedim init</h3>
        <p>
          Runs the Detector against your repository. Scans lockfiles, config files, folder structure,
          and dependencies to identify your framework, ORM, and language. Writes{' '}
          <code>sedim.config.ts</code> with the results.
        </p>
        <pre>
          <code>{`sedim init\nsedim init --force   # reinitialize even if already set up`}</code>
        </pre>

        <h3 id="sedim-add">sedim add</h3>
        <p>
          The main command. Loads the module manifest from the registry, runs the Thinker to build
          an install plan tailored to your stack and feature selections, shows the plan via
          Showbaby, then executes it with the Writer.
        </p>
        <pre>
          <code>{`sedim add auth\nsedim add auth --dry-run   # preview without writing\nsedim add auth --force     # skip conflict checks`}</code>
        </pre>

        <h3 id="sedim-plan">sedim plan</h3>
        <p>Compute and preview the install plan without writing any files.</p>
        <pre>
          <code>sedim plan auth</code>
        </pre>

        <h3 id="sedim-diff">sedim diff</h3>
        <p>Show per-file diffs of what a module install would change in your codebase.</p>
        <pre>
          <code>sedim diff auth</code>
        </pre>

        <h3 id="sedim-continue">sedim continue</h3>
        <p>
          Resume an interrupted module install. Sedim preserves session state when an install is
          cancelled mid-flow - run continue to pick up where you left off.
        </p>
        <pre>
          <code>sedim continue auth</code>
        </pre>

        <h3 id="sedim-doctor">sedim doctor</h3>
        <p>
          Validate your setup and diagnose common issues before stamping. Checks for sedim
          initialization, pending sessions, config validity, and environment readiness.
        </p>
        <pre>
          <code>sedim doctor</code>
        </pre>

        <h2 id="pipeline">Pipeline overview</h2>
        <p>
          Every <code>sedim add</code> command flows through four components. Each has a single
          responsibility and communicates through typed interfaces - no shared global state.
        </p>

        <h3 id="detector">Detector</h3>
        <p>
          Reads your repository to identify framework, ORM, language, database, and existing
          conventions. Stores facts in <code>sedim.config.ts</code>. Also detects conflicts - like
          an existing auth library - and warns before proceeding.
        </p>

        <h3 id="thinker">Thinker</h3>
        <p>
          Combines the module manifest (<code>registry/&lt;module&gt;/latest.json</code>) with your
          stack context and feature selections to produce an <code>InstallPlan</code>: a list of
          file operations, schema changes, and env vars required.
        </p>

        <h3 id="showbaby">Showbaby</h3>
        <p>
          All CLI UX lives here - prompts, spinners, progress bars, plan summaries, and conflict
          resolution. Streams the plan in real time so you see diffs and choices before anything
          is written.
        </p>

        <h3 id="writer">Writer</h3>
        <p>
          Executes the install plan atomically. Writes new files, patches existing ones, and injects
          imports. Core logic files use <code>overwriteStrategy: skip</code> - your edits are
          preserved. User-facing files (config, pages) use <code>overwriteStrategy: ask</code>.
        </p>

        <h2 id="stamped-structure">What gets stamped</h2>
        <p>
          Running <code>sedim add auth</code> generates a complete auth system under{' '}
          <code>src/sedim/auth/</code>:
        </p>
        <pre>
          <code>{`src/sedim/auth/
├── core/           # hash-password, session, pkce, totp, rbac, rate-limit...
├── adapters/       # framework + ORM adapters
├── ui/             # headless, tailwind, themed component tiers
├── emails/         # verification templates
└── schema.ts       # auto-generated for your ORM`}</code>
        </pre>

        <h2 id="supported-stacks">Supported stacks</h2>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Framework</th>
              <th>Drizzle</th>
              <th>Prisma</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Next.js (App Router)</strong>
              </td>
              <td>✓</td>
              <td>✓</td>
            </tr>
            <tr>
              <td>
                <strong>Express</strong>
              </td>
              <td>✓</td>
              <td>✓</td>
            </tr>
            <tr>
              <td>
                <strong>Hono</strong>
              </td>
              <td>✓</td>
              <td>✓</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
