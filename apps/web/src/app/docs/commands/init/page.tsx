import { DocsFlags, DocsTerminal } from '~/components/docs-command'

export const metadata = {
  title: 'sedim init',
}

export default function SedimInitPage() {
  return (
    <>
      <p className="docs-eyebrow">Commands</p>
      <h1 className="docs-title">sedim init</h1>
      <p className="docs-lead">
        Bootstraps your project by running the detector. Scans your repository for framework, ORM,
        language, and database - then writes a <code>sedim.config.ts</code> you can edit directly.
      </p>

      <div className="docs-content">
        <section className="docs-section">
          <h2>Usage</h2>
          <DocsTerminal>{`$ sedim init`}</DocsTerminal>
        </section>

        <section className="docs-section">
          <h2>Flags</h2>
          <DocsFlags
            flags={[
              {
                flag: '--force',
                description: 'Reinitialize even if sedim.config.ts already exists.',
              },
              {
                flag: '--cwd <path>',
                description: 'Run as if sedim was started in a different directory.',
              },
            ]}
          />
        </section>

        <section className="docs-section">
          <h2>What gets stored</h2>
          <p>
            The detector writes a <code>sedim.config.ts</code> at your project root with detected
            values for framework, ORM, database, and language. If detection confidence is low, the
            CLI prompts you to confirm or override each field interactively.
          </p>
          <DocsTerminal>{`// sedim.config.ts
export default {
  framework: 'nextjs',
  orm: 'drizzle',
  db: 'postgres',
  language: 'typescript',
  preferences: {
    ui: 'tailwind',
    confirmBeforeWrite: true,
    dryRunByDefault: false,
  },
}`}</DocsTerminal>
          <p>
            Re-run <code>sedim init --force</code> to regenerate from scratch, or edit the file
            directly to override detection.
          </p>
        </section>
      </div>
    </>
  )
}
