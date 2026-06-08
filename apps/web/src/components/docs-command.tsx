type DocsTerminalProps = {
  children: string
}

export function DocsTerminal({ children }: DocsTerminalProps) {
  return (
    <div className="docs-terminal">
      <div className="docs-terminal-header">
        <div className="docs-terminal-dots" aria-hidden="true">
          <span className="terminal-dot terminal-dot-red" />
          <span className="terminal-dot terminal-dot-yellow" />
          <span className="terminal-dot terminal-dot-green" />
        </div>
        <span className="docs-terminal-label">Terminal</span>
      </div>
      <pre className="docs-terminal-body">
        <code>{children}</code>
      </pre>
    </div>
  )
}

type DocsFlagRowProps = {
  flag: string
  description: string
}

export function DocsFlags({ flags }: { flags: DocsFlagRowProps[] }) {
  return (
    <div className="docs-flags">
      {flags.map((row, i) => (
        <div key={row.flag} className={`docs-flag-row${i === flags.length - 1 ? ' is-last' : ''}`}>
          <code className="docs-flag-name">{row.flag}</code>
          <span className="docs-flag-desc">{row.description}</span>
        </div>
      ))}
    </div>
  )
}
