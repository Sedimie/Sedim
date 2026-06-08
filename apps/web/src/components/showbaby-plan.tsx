import { showbabyPlanLines } from '~/lib/site-data'

const lineClass: Record<(typeof showbabyPlanLines)[number]['kind'], string> = {
  header: 'showbaby-line-header',
  create: 'showbaby-line-create',
  install: 'showbaby-line-install',
  env: 'showbaby-line-env',
  conflict: 'showbaby-line-conflict',
  summary: 'showbaby-line-summary',
}

export function ShowbabyPlan() {
  return (
    <div className="showbaby-plan doodle-card">
      <div className="showbaby-plan-chrome">
        <div className="showbaby-plan-dots" aria-hidden="true">
          <span className="terminal-dot terminal-dot-red" />
          <span className="terminal-dot terminal-dot-yellow" />
          <span className="terminal-dot terminal-dot-green" />
        </div>
        <span className="showbaby-plan-label">Showbaby · plan preview</span>
      </div>
      <div className="showbaby-plan-body">
        {showbabyPlanLines.map(line => (
          <div key={line.text} className={`showbaby-line ${lineClass[line.kind]}`}>
            {line.kind === 'create' && <span className="showbaby-glyph">+</span>}
            {line.kind === 'install' && <span className="showbaby-glyph">→</span>}
            {line.kind === 'env' && <span className="showbaby-glyph">●</span>}
            {line.kind === 'conflict' && <span className="showbaby-glyph">!</span>}
            <span>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
