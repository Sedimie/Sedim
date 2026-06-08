import Link from 'next/link'
import { SiteFooter } from '~/components/site-footer'
import { SiteHeader } from '~/components/site-header'
import { blog } from '~/lib/content'

export const metadata = {
  title: 'Blog',
}

export default function BlogPage() {
  const sorted = [...blog].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <SiteHeader active="blog" />
      <main className="content-page">
        <div className="container">
          <div className="content-page-header">
            <p className="eyebrow">Blog</p>
            <h1 className="section-title">
              Updates from the <span className="display-italic">workbench.</span>
            </h1>
            <p className="section-description">
              Release notes, architecture decisions, and thoughts on the stamp model.
            </p>
          </div>

          {sorted.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Blog posts coming soon.</p>
          ) : (
            <div className="content-list">
              {sorted.map(post => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="content-list-item">
                  <div className="content-list-title">{post.title}</div>
                  <div className="content-list-desc">{post.description}</div>
                  <div className="content-list-meta">{post.date}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
