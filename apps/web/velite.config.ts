import { defineConfig, s } from 'velite'

export default defineConfig({
  root: './content',
  collections: {
    guides: {
      name: 'Guide',
      pattern: 'guides/**/*.md',
      schema: s.object({
        title: s.string(),
        description: s.string(),
        date: s.isodate().optional(),
        tags: s.array(s.string()).optional(),
        slug: s.string(),
        content: s.markdown(),
      }),
    },
    reference: {
      name: 'Reference',
      pattern: 'reference/**/*.md',
      schema: s.object({
        title: s.string(),
        description: s.string(),
        slug: s.string(),
        content: s.markdown(),
      }),
    },
    blog: {
      name: 'Post',
      pattern: 'blog/**/*.md',
      schema: s.object({
        title: s.string(),
        description: s.string(),
        date: s.isodate(),
        tags: s.array(s.string()).optional(),
        slug: s.string(),
        content: s.markdown(),
      }),
    },
  },
})
