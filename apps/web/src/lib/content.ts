import { blog, guides, reference } from 'content'

export { blog, guides, reference }

export function getGuide(slug: string) {
  return guides.find(g => g.slug === slug)
}

export function getReference(slug: string) {
  return reference.find(r => r.slug === slug)
}

export function getBlogPost(slug: string) {
  return blog.find(b => b.slug === slug)
}
