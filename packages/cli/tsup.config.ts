import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  target: 'node18',
  format: ['esm'],
  splitting: false,
  sourcemap: false,
  dts: false,
  clean: true,
  onSuccess: async () => {
    mkdirSync('dist/fonts', { recursive: true })
    mkdirSync('fonts', { recursive: true })
    const fontSrc = path.resolve('node_modules/figlet/fonts/Block.flf')
    copyFileSync(fontSrc, 'dist/fonts/Block.flf')
    copyFileSync(fontSrc, 'fonts/Block.flf')
  },
})
