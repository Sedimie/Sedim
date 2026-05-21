import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Sedim',
  description: 'Install complete features. Own every line.',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#2563eb' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Sedim',
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Auth', link: '/auth/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'Concepts', link: '/concepts/' },
      { text: 'Roadmap', link: '/roadmap/' },
      { text: 'Contributing', link: '/contributing' },
    ],
    sidebar: {
      '/guide/': [
        { text: 'Getting Started', items: [
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Quick Start', link: '/guide/quick-start' },
          { text: 'First Auth Setup', link: '/guide/first-auth' },
        ]},
      ],
      '/auth/': [
        { text: 'Auth Module', items: [
          { text: 'Overview', link: '/auth/' },
          { text: 'Configuration', link: '/auth/config' },
          { text: 'Features', link: '/auth/features' },
          { text: 'Framework Adapters', link: '/auth/adapters' },
          { text: 'Schema', link: '/auth/schema' },
        ]},
      ],
      '/cli/': [
        { text: 'CLI Reference', items: [
          { text: 'Overview', link: '/cli/' },
          { text: 'init', link: '/cli/init' },
          { text: 'add', link: '/cli/add' },
          { text: 'plan', link: '/cli/plan' },
          { text: 'diff', link: '/cli/diff' },
          { text: 'doctor', link: '/cli/doctor' },
        ]},
      ],
      '/concepts/': [
        { text: 'Concepts', items: [
          { text: 'Stamping Model', link: '/concepts/stamping' },
          { text: 'The Registry', link: '/concepts/registry' },
          { text: 'Module Manifest', link: '/concepts/manifest' },
        ]},
      ],
      '/guides/': [
        { text: 'Guides', items: [
          { text: 'Google OAuth Setup', link: '/guides/google-oauth' },
          { text: 'TOTP Enrollment', link: '/guides/totp' },
          { text: 'Production Deployment', link: '/guides/production' },
        ]},
      ],
      '/roadmap/': [
        { text: 'Roadmap', items: [
          { text: 'Project Roadmap', link: '/roadmap/' },
        ]},
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/sedim-dev/sedim' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Sedim',
    },
    search: {
      provider: 'local',
    },
  },
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
  ignoreDeadLinks: true,
})