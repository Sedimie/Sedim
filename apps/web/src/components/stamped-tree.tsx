import { stampedFileTree } from '~/lib/site-data'

export function StampedTree() {
  return (
    <div className="stamped-tree doodle-card">
      <div className="stamped-tree-header">
        <span className="stamped-tree-label">What gets stamped</span>
        <span className="stamped-tree-badge">sedim add auth</span>
      </div>
      <pre className="stamped-tree-body" aria-label="Stamped file tree">
        {stampedFileTree.map(line => (
          <span key={line} className="stamped-tree-line">
            {line}
            {'\n'}
          </span>
        ))}
      </pre>
    </div>
  )
}
