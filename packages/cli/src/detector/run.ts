// quick runner to test the detector against the playground
// usage: npx tsx src/detector/run.ts <path-to-project>
// example: npx tsx src/detector/run.ts ../../../apps/playground

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detect } from './index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../../../../apps/playground')

console.log(`\nRunning detector against: ${target}\n`)

detect(target)
  .then(ctx => {
    console.log(JSON.stringify(ctx, null, 2))
  })
  .catch(err => {
    console.error('Detection failed:', err)
    process.exit(1)
  })
