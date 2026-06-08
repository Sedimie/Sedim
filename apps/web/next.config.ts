import fs from 'node:fs'
import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Only needed when apps/web lives inside the pnpm monorepo.
// On sedim-web (synced standalone deploy repo), this breaks Vercel with
// doubled paths like /vercel/path0/vercel/path0/.next/routes-manifest.json
const monorepoRoot = path.join(__dirname, '../..')
const isMonorepo = fs.existsSync(path.join(monorepoRoot, 'pnpm-workspace.yaml'))

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  ...(isMonorepo ? { outputFileTracingRoot: monorepoRoot } : {}),
}

export default nextConfig
