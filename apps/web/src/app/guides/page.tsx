import Link from 'next/link'
import { guides } from '~/lib/content'

export const metadata = {
  title: 'Guides',
}

export default function GuidesPage() {
  return (
    <main className="content-page">
      <div className="container">
        <div className="content-page-header">
          <p className="eyebrow">Guides</p>
          <h1 className="section-title">
            Learn the concepts. <span className="display-italic">Then stamp.</span>
          </h1>
          <p className="section-description">
            Understanding-first documentation. Each guide teaches how and why a feature works, then
            points you to <code>sedim add</code>.
          </p>
        </div>

        {guides.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Guides coming soon.</p>
        ) : (
          <div className="content-list">
            {guides.map(guide => (
              <Link key={guide.slug} href={`/guides/${guide.slug}`} className="content-list-item">
                <div className="content-list-title">{guide.title}</div>
                <div className="content-list-desc">{guide.description}</div>
                {guide.date && <div className="content-list-meta">{guide.date}</div>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
