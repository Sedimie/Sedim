export const YOUTUBE_WALKTHROUGH_ID = 'HPEjs7-O_vk'

export const heroTagline = {
  line: 'Install complete features.',
  accent: 'Own every line.',
  kicker: 'Codegen so smort it feels like AI.',
  subtitle:
    'Sedim stamps full-stack modules: frontend, backend, schema, and UI, directly into src/sedim/. You own every file. Zero runtime dependency after stamping.',
}

export const engineeringHighlights = [
  {
    title: 'Remote registry',
    detail: 'Every sedim add fetches the latest manifest and templates from GitHub. Small npm package, always current.',
  },
  {
    title: 'Conflict-aware planning',
    detail: 'Detects existing auth, schema collisions, and user-table migrations before a single byte is written.',
  },
  {
    title: 'Skip strategy',
    detail: 'Core logic files use overwriteStrategy: skip. Your customizations are never silently overwritten.',
  },
  {
    title: 'Resumable installs',
    detail: 'Interrupted mid-stamp? sedim continue picks up from the saved plan snapshot in .sedim/session.json.',
  },
] as const

export const showbabyPlanLines = [
  { kind: 'header' as const, text: 'Plan - auth' },
  { kind: 'create' as const, text: 'CREATE   src/sedim/auth/core/session.ts' },
  { kind: 'create' as const, text: 'CREATE   src/sedim/auth/adapters/framework/operations.ts' },
  { kind: 'create' as const, text: 'CREATE   src/app/api/auth/[...all]/route.ts' },
  { kind: 'install' as const, text: 'INSTALL  argon2, @oslojs/crypto, jose' },
  { kind: 'env' as const, text: 'ENV      AUTH_SECRET - random 32+ char secret' },
  { kind: 'env' as const, text: 'ENV      GOOGLE_CLIENT_ID - OAuth client ID' },
  { kind: 'conflict' as const, text: 'CONFLICT schema (users) - needs-migration: email_verified' },
  { kind: 'summary' as const, text: '12 files · 3 deps · 2 env groups · 1 partial conflict' },
] as const

export const stampedFileTree = [
  'src/sedim/auth/',
  '├── core/',
  '│   ├── hash-password.ts      # Argon2id (OWASP params)',
  '│   ├── session.ts            # sliding-window sessions',
  '│   ├── pkce.ts               # RFC 7636 S256 only',
  '│   ├── totp.ts               # RFC 6238 + encrypted secrets',
  '│   ├── jwt.ts                # hybrid JWT + refresh tokens',
  '│   └── rbac.ts               # role middleware factories',
  '├── adapters/',
  '│   ├── drizzle.ts            # your ORM adapter',
  '│   └── framework/nextjs.ts   # route handler factory',
  '├── ui/tailwind/              # or headless / themed',
  '│   ├── LoginForm.tsx',
  '│   └── SignupForm.tsx',
  '├── schema.ts                 # users, sessions, oauth…',
  '└── config.ts                 # wire db + providers',
  'src/app/api/auth/[...all]/route.ts',
] as const

export const INSTALL_CMD = 'npm i -g @sedim/cli'

export const navLinks = [
  { label: 'Docs', href: '/docs', activeKey: 'docs' as const },
  { label: 'Guides', href: '/guides', activeKey: 'guides' as const },
  { label: 'Reference', href: '/reference', activeKey: 'reference' as const },
  { label: 'Blog', href: '/blog', activeKey: 'blog' as const },
  { label: 'GitHub', href: 'https://github.com/Sedimie/Sedim', external: true },
] as const

export const pipelineStages = [
  {
    num: '01',
    title: 'Detector',
    description:
      'Reads your repository - framework, ORM, DB, folder conventions, lockfiles - and stores facts in sedim.config.ts.',
  },
  {
    num: '02',
    title: 'Thinker',
    description:
      'Loads the module manifest from the registry, maps it onto your stack, and builds an install plan - files, migrations, env vars.',
  },
  {
    num: '03',
    title: 'Showbaby',
    description:
      'Walks you through feature selection, shows diffs and conflicts in real time, and confirms the plan before anything writes.',
  },
  {
    num: '04',
    title: 'Writer',
    description:
      'Fetches remote source files and stamps them into src/sedim/. Core logic uses skip strategy - your edits stay safe.',
  },
] as const

export const workflowSteps = [
  {
    step: '01',
    title: 'Install & init',
    cmd: 'sedim init',
    description:
      'Install the CLI globally. Run init in your project - the Detector identifies your framework, ORM, and database, then writes sedim.config.ts.',
  },
  {
    step: '02',
    title: 'Add a module',
    cmd: 'sedim add auth',
    description:
      'Pick features (OAuth, TOTP, magic links, RBAC…), choose a UI tier, review the install plan, and confirm. Use plan, diff, or --dry-run first if you want.',
  },
  {
    step: '03',
    title: 'Configure & migrate',
    cmd: 'drizzle-kit push',
    description:
      'Set env vars step-by-step during the install flow. Sedim generates migrations for your ORM - run them, and the schema is ready.',
  },
  {
    step: '04',
    title: 'Run & customize',
    cmd: 'npm run dev',
    description:
      'Ship with working defaults immediately. Every stamped file lives under src/sedim/ - read it, edit it, test it, push it. No SDK to fight.',
  },
] as const

export const stackSupport = {
  frameworks: [
    { name: 'Next.js (App Router)', note: 'Full-stack - frontend + API routes', fullStack: true },
    { name: 'Express', note: 'Backend with React or Vue frontend', fullStack: false },
    { name: 'Hono', note: 'Backend with React or Vue frontend', fullStack: false },
  ],
  orms: ['Drizzle', 'Prisma'],
  databases: ['PostgreSQL', 'MySQL', 'SQLite'],
  note: 'Framework, DB, and ORM agnostic by design. The Detector adapts the stamp plan to whatever you already run.',
} as const

export const uiTiers = [
  {
    tier: 'Headless',
    tagline: 'Bring your own design system',
    description:
      'Zero CSS - pure logic and markup. Wire into your existing component library or design tokens without fighting pre-baked styles.',
  },
  {
    tier: 'Styled',
    tagline: 'Tailwind out of the box',
    description:
      'Fully styled with Tailwind classes that work with your existing config. Ship immediately, tweak classes locally.',
  },
  {
    tier: 'Themed',
    tagline: 'CSS token themes',
    description:
      'Pre-built themes with CSS custom properties - minimal, glass, and more. Swap tokens, keep the logic.',
  },
] as const

export const modules = [
  {
    command: 'sedim add auth',
    category: 'IDENTITY',
    description:
      'Sessions, OAuth, TOTP, magic links, JWT, RBAC/ABAC. Frontend + backend + schema, wired to your DB. The first POC - shipping now.',
    status: 'available' as const,
    href: '/docs#quickstart',
  },
  {
    command: 'sedim add payments',
    category: 'COMMERCE',
    description: 'Stripe checkout, webhooks, customer portal, recurring billing. Schema and UI included.',
    status: 'roadmap' as const,
  },
  {
    command: 'sedim add notifications',
    category: 'MESSAGING',
    description: 'Email, push, and in-app notifications. Multi-channel dispatch with typed templates.',
    status: 'roadmap' as const,
  },
  {
    command: 'sedim add chat',
    category: 'REALTIME',
    description: 'WebSocket messaging, rooms, presence, and UI components. Scale modes from single-node to pub/sub.',
    status: 'roadmap' as const,
  },
  {
    command: 'sedim add webrtc',
    category: 'MEDIA',
    description: 'Peer-to-peer video and audio, screen share, TURN fallback. Self-hostable, inspectable code.',
    status: 'roadmap' as const,
  },
  {
    command: 'sedim add ai-rag',
    category: 'AI',
    description: 'RAG pipelines, embeddings, vector search, and chat UI. pgvector-first, model-agnostic.',
    status: 'roadmap' as const,
  },
] as const

export const authFeatures = [
  { name: 'Password auth', detail: 'Argon2id (OWASP params), lockout after 10 failed attempts' },
  { name: 'Sessions', detail: 'SHA-256 hashed tokens, httpOnly cookies, full revocation' },
  { name: 'OAuth', detail: 'Google, GitHub, Discord - PKCE S256 only (RFC 7636)' },
  { name: 'TOTP / 2FA', detail: 'RFC 6238, AES-256-GCM encrypted secrets, backup codes' },
  { name: 'Magic links', detail: 'Non-enumerating - always returns success' },
  { name: 'JWT hybrid', detail: 'Short-lived signed JWTs + DB-backed refresh tokens' },
  { name: 'RBAC / ABAC', detail: 'Middleware factories you apply in your own routes' },
  { name: 'Rate limiting', detail: 'Sliding window, in-memory default, Redis-ready interface' },
] as const

export const authRoadmap = [
  'Redis-backed session and rate-limit store',
  'Biometric auth flows',
  'Additional OAuth providers',
  'More frameworks and database adapters',
] as const

export const moduleRoadmap = [
  {
    module: 'Auth',
    status: 'active' as const,
    milestones: ['Redis store', 'Biometric', 'More OAuth providers', 'More frameworks & DBs'],
  },
  {
    module: 'Notifications',
    status: 'planned' as const,
    milestones: ['Email', 'Push', 'In-app', 'Multi-channel dispatch'],
  },
  {
    module: 'Chat',
    status: 'planned' as const,
    milestones: ['WebSocket rooms', 'Presence', 'Thread support', 'Pub/sub scale mode'],
  },
  {
    module: 'WebRTC',
    status: 'planned' as const,
    milestones: ['P2P calls', 'Screen share', 'TURN fallback', 'Recording pipeline'],
  },
  {
    module: 'Payments',
    status: 'planned' as const,
    milestones: ['Stripe checkout', 'Webhooks', 'Customer portal', 'Recurring billing'],
  },
  {
    module: 'AI RAG',
    status: 'planned' as const,
    milestones: ['Embeddings', 'Vector search', 'Chat UI', 'Multi-model routing'],
  },
] as const

export const commands = [
  {
    cmd: 'npm install -g @sedim/cli',
    description: 'Install the CLI from npm. Zero global state, zero side effects.',
  },
  {
    cmd: 'sedim init',
    description: 'Run the Detector. Stores your stack into sedim.config.ts.',
  },
  {
    cmd: 'sedim add <module>',
    description: 'Plan and inject a fully-wired module into your codebase.',
  },
  {
    cmd: 'sedim plan <module>',
    description: 'Preview the install plan without writing any files.',
  },
  {
    cmd: 'sedim diff <module>',
    description: 'Show per-file diffs of what a module install would change.',
  },
  {
    cmd: 'sedim continue [module]',
    description: 'Resume an interrupted module install from where you left off.',
  },
  {
    cmd: 'sedim doctor',
    description: 'Validate your setup and diagnose common issues before stamping.',
  },
  {
    cmd: 'sedim add <module> --dry-run',
    description: 'Full interactive flow with zero writes. Review everything first.',
  },
] as const

export const docsNav = [
  {
    title: 'Getting Started',
    links: [
      { label: 'Introduction', href: '/docs' },
      { label: 'Quickstart', href: '/docs#quickstart' },
      { label: 'Configuration', href: '/docs#configuration' },
    ],
  },
  {
    title: 'Commands',
    links: [
      { label: 'sedim init', href: '/docs/commands/init' },
      { label: 'sedim add', href: '/docs#sedim-add' },
      { label: 'sedim continue', href: '/docs#sedim-continue' },
      { label: 'sedim plan', href: '/docs#sedim-plan' },
      { label: 'sedim diff', href: '/docs#sedim-diff' },
      { label: 'sedim doctor', href: '/docs#sedim-doctor' },
    ],
  },
  {
    title: 'Internals',
    links: [
      { label: 'Pipeline overview', href: '/docs#pipeline' },
      { label: 'Detector', href: '/docs#detector' },
      { label: 'Thinker', href: '/docs#thinker' },
      { label: 'Showbaby', href: '/docs#showbaby' },
      { label: 'Writer', href: '/docs#writer' },
    ],
  },
] as const

export const footerColumns = [
  {
    title: 'Product',
    links: [
      { label: 'Landing', href: '/' },
      { label: 'Documentation', href: '/docs' },
      { label: 'Guides', href: '/guides' },
      { label: 'Reference', href: '/reference' },
      { label: 'Modules', href: '/#modules' },
    ],
  },
  {
    title: 'Internals',
    links: [
      { label: 'Detector', href: '/docs#detector' },
      { label: 'Thinker', href: '/docs#thinker' },
      { label: 'Showbaby', href: '/docs#showbaby' },
      { label: 'Writer', href: '/docs#writer' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'GitHub', href: 'https://github.com/Sedimie/Sedim', external: true as const },
      { label: 'Discord', href: 'https://discord.com/invite/H7yutstM', external: true as const },
      { label: 'Contributing', href: 'https://github.com/Sedimie/Sedim/blob/main/CONTRIBUTING.md', external: true as const },
    ],
  },
] as const

export type FooterLink = (typeof footerColumns)[number]['links'][number]

export const terminalLines = [
  { type: 'command' as const, text: '$ npm install -g @sedim/cli' },
  { type: 'success' as const, text: '✓ sedim@1.0.0 installed globally' },
  { type: 'command' as const, text: '$ sedim init' },
  { type: 'info' as const, text: 'detector  scanning repository...' },
  { type: 'detail' as const, text: 'framework   next.js 14 · app router' },
  { type: 'detail' as const, text: 'database    postgresql · drizzle' },
  { type: 'detail' as const, text: 'language    typescript · strict' },
  { type: 'success' as const, text: '✓ wrote sedim.config.ts' },
  { type: 'command' as const, text: '$ sedim add auth' },
  { type: 'info' as const, text: 'thinker   drafting module plan...' },
  { type: 'info' as const, text: 'showbaby  12 files · 0 conflicts' },
  { type: 'file' as const, text: '→ src/sedim/auth/core/session.ts' },
  { type: 'file' as const, text: '→ src/app/api/auth/[...all]/route.ts' },
]

export const missionStatement = {
  headline: 'The 80% is repetitive.',
  headlineAccent: 'Ship the 20%.',
  body: 'Sedim sets a standard - up-to-date, secure, clean boilerplate for full-stack web features. It stamps that code into your project, framework and DB agnostic, with three UI tiers per module. Passion project or enterprise - you own the output forever.',
}

export const philosophyPillars = [
  {
    title: 'Boilerplate, not an SDK',
    description:
      'Treat Sedim as standardized implementation code you copy into your repo - not a dependency you call at runtime. Learn the patterns from docs, stamp them when needed, customize locally.',
  },
  {
    title: 'Framework & DB agnostic',
    description:
      'Next.js full-stack, or Express/Hono with React/Vue. Drizzle or Prisma. PostgreSQL, MySQL, SQLite. The Detector adapts - no greenfield required.',
  },
  {
    title: 'Endless customization',
    description:
      'Files land under src/sedim/. Edit, test, push. No vendor lock-in, no black box. The code you own is the best code - and AI agents skip straight to customization without wasting tokens on grunt work.',
  },
] as const

export const audiences = [
  {
    label: 'Hackathon & indie',
    title: 'Working defaults tonight',
    description:
      'Stamp auth with OAuth and a styled UI in minutes. Skip the repetitive RFC research - customize only what makes your product unique.',
  },
  {
    label: 'Enterprise teams',
    title: 'Audit what you ship',
    description:
      'Every security decision is readable source in your repo. Argon2id, PKCE, encrypted TOTP secrets - reviewable, not opaque SDK behavior.',
  },
  {
    label: 'AI-assisted dev',
    title: 'Skip the hallucinations',
    description:
      'Agents customize stamped, production-hardened code instead of writing auth from scratch. No security gaps, no token waste on solved problems.',
  },
  {
    label: 'Existing codebases',
    title: 'Detects what you run',
    description:
      'sedim init reads your stack before planning. Stamps into your folder structure, your ORM, your conventions - not a parallel universe.',
  },
] as const

export const comparisons = [
  {
    approach: 'Runtime SDK',
    examples: 'Clerk, Auth0, Supabase Auth',
    ownership: 'Vendor owns runtime',
    customization: 'API surface only',
    lockIn: 'High',
    sedim: false,
  },
  {
    approach: 'Headless library',
    examples: 'Better Auth, NextAuth',
    ownership: 'You configure it',
    customization: 'Deep, but you wire everything',
    lockIn: 'Medium',
    sedim: false,
  },
  {
    approach: 'Copy-paste UI',
    examples: 'shadcn/ui blocks',
    ownership: 'You own components',
    customization: 'UI only, no backend',
    lockIn: 'Low',
    sedim: false,
  },
  {
    approach: 'AI codegen',
    examples: 'Cursor, Claude, Copilot',
    ownership: 'You own output',
    customization: 'Varies every run',
    lockIn: 'Low',
    sedim: false,
  },
  {
    approach: 'Sedim stamp model',
    examples: 'sedim add auth',
    ownership: 'You own every file',
    customization: 'Full - edit locally forever',
    lockIn: 'None at runtime',
    sedim: true,
  },
] as const

export const groundwork = {
  title: 'Groundwork',
  subtitle: 'RFC-grade docs for full-stack features',
  description:
    'Groundwork is community-maintained standard documentation for web feature implementations - security, speed, and scalability tradeoffs in one place. Like RFCs, but for the patterns Sedim stamps: how sessions work, why PKCE matters, when to reach for Redis.',
  points: [
    'Concept-first guides - how and why a feature works before you stamp it',
    'Security and scalability tradeoffs documented explicitly',
    'Pairs with Sedim: learn the standard, then run sedim add',
  ],
  href: '/guides',
} as const

export const workspaceMoments = [
  {
    label: 'Architecture',
    caption: 'CLI engine fetches from the remote registry and stamps into src/sedim/moduleX',
    image: '/architecture-diagram.png',
  },
  {
    label: 'Stamped output',
    caption: 'Every file under src/sedim/ - readable, editable, in your git history',
    image: '/banner.jpeg',
  },
] as const
