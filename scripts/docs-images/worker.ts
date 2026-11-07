import { parentPort, workerData } from 'node:worker_threads'
import { DOC_IMAGES } from './images'
import { renderImage } from './render-image'

const { name, outDir } = workerData as { name: string; outDir: string }
const image = DOC_IMAGES.find((candidate) => candidate.name === name)
if (!image) throw new Error(`no doc image named ${name}`)

parentPort?.postMessage(renderImage(image, outDir))
