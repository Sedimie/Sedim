import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteFooter } from '~/components/site-footer'
import { SiteHeader } from '~/components/site-header'
import { getReference, reference } from '~/lib/content'

type Props = { params: Promise<{ slug: string[] }> }

export async function generateStaticParams() {
  return reference.map(r => ({ slug: r.slug.split('/') }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const doc = getReference(slug.join('/'))
  if (!doc) return { title: 'Reference not found' }
  return { title: doc.title, description: doc.description }
}

export default async function ReferencePage({ params }: Props) {
  const { slug } = await params
  const doc = getReference(slug.join('/'))
  if (!doc) notFound()

  return (
    <>
      <SiteHeader />
      <main className="content-page">
        <div className="container prose-content" style={{ maxWidth: 720 }}>
          <Link href="/reference" className="text-link" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>
            ← All reference
          </Link>
          <h1>{doc.title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{doc.description}</p>
          <div className="prose-body" dangerouslySetInnerHTML={{ __html: doc.content }} />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
