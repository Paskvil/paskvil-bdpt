/**
 * renders the article's images - `npm run docs:images -- [--out <dir>] [name filter...]`
 *
 * one worker thread per image, as many at once as there are CPU cores. without filters it
 * renders all of them (~13 minutes on 8 cores - the 60-sample BDPT image alone takes ~10, each
 * image is single-threaded); a filter keeps the images whose name contains it,
 * e.g. `npm run docs:images -- strategy-4` or `-- compare sds`
 */
import { mkdirSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { DOC_IMAGES } from './images'

const DEFAULT_OUT = 'dist/docs-images'

const { outDir, filters } = parseArguments(process.argv.slice(2))
const images = DOC_IMAGES.filter(
  ({ name }) => filters.length === 0 || filters.some((filter) => name.includes(filter)),
)

mkdirSync(outDir, { recursive: true })
console.log(`rendering ${images.length} images into ${outDir}`)

const queue = images.map((image) => image.name)
const workerCount = Math.min(availableParallelism(), queue.length)
await Promise.all(Array.from({ length: workerCount }, renderNext))

/** one worker at a time per slot, until the queue is empty */
async function renderNext(): Promise<void> {
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    const result = await renderInWorker(name)
    console.log(
      `${name.padEnd(28)} ${String(result.samples).padStart(4)} spp  ${result.seconds.toFixed(0)} s`,
    )
  }
}

function renderInWorker(name: string): Promise<{ samples: number; seconds: number }> {
  // the worker inherits Node's `--import tsx`, so it can load the TypeScript sources too
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    workerData: { name, outDir },
  })
  return new Promise((done, fail) => {
    worker.once('message', done)
    worker.once('error', fail)
  })
}

/** `--out <dir>` anywhere, everything else is a name filter */
function parseArguments(args: string[]): { outDir: string; filters: string[] } {
  let outDir = DEFAULT_OUT
  const filters: string[] = []
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--out') outDir = args[++index] ?? DEFAULT_OUT
    else filters.push(args[index])
  }
  return { outDir: resolve(outDir), filters }
}
