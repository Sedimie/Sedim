import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getGuide, guides } from '~/lib/content'

type Props = { params: Promise<{ slug: string[] }> }

export async function generateStaticParams() {
  return guides.map(g => ({ slug: g.slug.split('/') }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const guide = getGuide(slug.join('/'))
  if (!guide) return { title: 'Guide not found' }
  return { title: guide.title, description: guide.description }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = getGuide(slug.join('/'))
  if (!guide) notFound()

  return (
    <main className="content-page">
      <div className="container prose-content" style={{ maxWidth: 720 }}>
        <Link href="/guides" className="text-link" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>
          ← All guides
        </Link>
        <h1>{guide.title}</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{guide.description}</p>
        <div className="prose-body" dangerouslySetInnerHTML={{ __html: guide.content }} />
      </div>
    </main>
  )
}
