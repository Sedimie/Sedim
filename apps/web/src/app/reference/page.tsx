import Link from 'next/link'
import { reference } from '~/lib/content'

export const metadata = {
  title: 'Reference',
}

export default function ReferencePage() {
  return (
    <main className="content-page">
      <div className="container">
        <div className="content-page-header">
          <p className="eyebrow">Reference</p>
          <h1 className="section-title">
            Implementation details. <span className="display-italic">No fluff.</span>
          </h1>
          <p className="section-description">
            API references, CLI internals, and type definitions from the actual Sedim packages.
          </p>
        </div>

        {reference.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Reference docs coming soon.</p>
        ) : (
          <div className="content-list">
            {reference.map(doc => (
              <Link key={doc.slug} href={`/reference/${doc.slug}`} className="content-list-item">
                <div className="content-list-title">{doc.title}</div>
                <div className="content-list-desc">{doc.description}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
