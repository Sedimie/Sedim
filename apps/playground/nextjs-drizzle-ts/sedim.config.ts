import type { SedimConfig } from '@sedim/core'

const config: SedimConfig = {
  version: '0.1.0',
  framework: 'nextjs',
  orm: 'drizzle',
  db: 'postgres',
  preferences: {
    ui: 'tailwind',
    confirmBeforeWrite: true,
    dryRunByDefault: false,
  },
}

export default config
