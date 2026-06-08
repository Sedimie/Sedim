import { terminalLines } from '~/lib/site-data'

export function TerminalDemo() {
  return (
    <div className="terminal-window" role="img" aria-label="Sedim CLI demonstration">
      <div className="terminal-chrome">
        <span className="terminal-dot terminal-dot-red" />
        <span className="terminal-dot terminal-dot-yellow" />
        <span className="terminal-dot terminal-dot-green" />
      </div>
      <div className="terminal-body">
        {terminalLines.map((line, i) => (
          <div key={i} className={`terminal-line terminal-line-${line.type}`}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  )
}
