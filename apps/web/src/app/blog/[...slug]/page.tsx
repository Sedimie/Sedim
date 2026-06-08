import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteFooter } from '~/components/site-footer'
import { SiteHeader } from '~/components/site-header'
import { blog, getBlogPost } from '~/lib/content'

type Props = { params: Promise<{ slug: string[] }> }

export async function generateStaticParams() {
  return blog.map(b => ({ slug: b.slug.split('/') }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const post = getBlogPost(slug.join('/'))
  if (!post) return { title: 'Post not found' }
  return { title: post.title, description: post.description }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getBlogPost(slug.join('/'))
  if (!post) notFound()

  return (
    <>
      <SiteHeader active="blog" />
      <main className="content-page">
        <div className="container prose-content" style={{ maxWidth: 720 }}>
          <Link href="/blog" className="text-link" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>
            ← All posts
          </Link>
          <p className="content-list-meta" style={{ marginBottom: '0.5rem' }}>{post.date}</p>
          <h1>{post.title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{post.description}</p>
          <div className="prose-body" dangerouslySetInnerHTML={{ __html: post.content }} />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
