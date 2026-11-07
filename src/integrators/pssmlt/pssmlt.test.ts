import { describe, expect, it } from 'vitest'
import { Film } from '../../film/film'
import { vec3 } from '../../math/vec3'
import { Sfc32 } from '../../rng/random'
import { Camera } from '../../scene/camera'
import { createCornellBox, type BallMaterials } from '../../scene/cornell-box'
import { Scene } from '../../scene/scene'
import { Bdpt } from '../bdpt/bdpt'
import { PathTracer } from '../path-tracer'
import { createFurnace, furnaceRadiance } from '../test-scenes'
import { Pssmlt } from './pssmlt'

const MUTATION = { largeStepProbability: 0.3, smallStepSize: 0.01 }

/** PSSMLT on top of power-heuristic BDPT, `mutationsPerPixel` spread over a few chains */
function renderMlt(scene: Scene, size: number, mutationsPerPixel: number, seed: number): Film {
  const bdpt = new Bdpt(scene, { maxDepth: 5, heuristic: 'power' })
  const mlt = new Pssmlt(bdpt, size, size, { ...MUTATION, bootstrapSamples: 20_000, seed })
  const film = new Film(size, size)
  const chains = 16
  const mutationsPerChain = (mutationsPerPixel * size * size) / chains
  for (let chain = 0; chain < chains; chain++) mlt.runChain(chain, mutationsPerChain, film)
  film.addSplatOnlySamples(mutationsPerChain * chains)
  return film
}

function renderPathTraced(scene: Scene, size: number, samplesPerPixel: number, seed: number): Film {
  const tracer = new PathTracer(scene, { maxDepth: 5 })
  const film = new Film(size, size)
  const random = new Sfc32(seed)
  for (let pass = 0; pass < samplesPerPixel; pass++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) tracer.renderSample(x, y, film, random)
    }
  }
  return film
}

function blockMean(film: Film, x0: number, y0: number, blockSize: number): number[] {
  const sum = [0, 0, 0]
  for (let y = y0; y < y0 + blockSize; y++) {
    for (let x = x0; x < x0 + blockSize; x++) {
      const { r, g, b } = film.average(x, y)
      sum[0] += r
      sum[1] += g
      sum[2] += b
    }
  }
  return sum.map((channel) => channel / (blockSize * blockSize))
}

/** mean over batches of a block's mean colour, and the standard error of that mean */
function blockStatistics(films: Film[], x0: number, y0: number, blockSize: number) {
  const batchMeans = films.map((film) => blockMean(film, x0, y0, blockSize))
  const mean = [0, 1, 2].map((c) => average(batchMeans.map((batch) => batch[c])))
  const standardError = [0, 1, 2].map((c) => {
    const variance = average(batchMeans.map((batch) => (batch[c] - mean[c]) ** 2))
    return Math.sqrt(variance / (films.length - 1))
  })
  return { mean, standardError }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** as in the BDPT tests: the demo's box looking down at the floor, no light panel in view */
function cornellBoxFloorView(size: number, balls: BallMaterials): Scene {
  const lights = { top: true, left: true, right: true }
  const box = createCornellBox({ lights, balls, width: size, height: size })
  const camera = new Camera(vec3(0.5, 0.7, 0.95), vec3(0.5, 0, 0.4), 40, size, size)
  return new Scene(box.objects, camera)
}

describe('Pssmlt', () => {
  it('converges to Le / (1 - albedo) in a furnace', () => {
    const size = 4
    const film = renderMlt(createFurnace(1, 0.5, size), size, 2000, 1)
    expect(blockMean(film, 0, 0, size)[0]).toBeCloseTo(furnaceRadiance(1, 0.5), 1)
  })

  it('is reproducible for a seed, different for another', () => {
    const scene = createFurnace(1, 0.5, 4)
    const first = blockMean(renderMlt(scene, 4, 50, 1), 0, 0, 4)
    expect(blockMean(renderMlt(scene, 4, 50, 1), 0, 0, 4)).toEqual(first)
    expect(blockMean(renderMlt(scene, 4, 50, 2), 0, 0, 4)).not.toEqual(first)
  })

  /** as for BDPT: independent batches, agreement within 4 standard errors */
  it.each([
    { left: 'diffuse', right: 'diffuse' },
    { left: 'mirror', right: 'glass' },
  ] as const)(
    'matches the path tracer on the Cornell box, balls %o',
    (balls) => {
      const size = 16
      const blockSize = 4
      const batches = 5
      const scene = cornellBoxFloorView(size, balls)
      const pathTraced = Array.from({ length: batches }, (_, batch) =>
        renderPathTraced(scene, size, 1000, batch),
      )
      const metropolis = Array.from({ length: batches }, (_, batch) =>
        renderMlt(scene, size, 100, 100 + batch),
      )

      for (let y = 0; y < size; y += blockSize) {
        for (let x = 0; x < size; x += blockSize) {
          const expected = blockStatistics(pathTraced, x, y, blockSize)
          const actual = blockStatistics(metropolis, x, y, blockSize)
          for (let channel = 0; channel < 3; channel++) {
            const error = Math.abs(actual.mean[channel] - expected.mean[channel])
            const standardError = Math.hypot(
              actual.standardError[channel],
              expected.standardError[channel],
            )
            expect(error, `block (${x}, ${y}), channel ${channel}`).toBeLessThan(
              4 * standardError + 1e-3,
            )
          }
        }
      }
    },
    120_000,
  )
})
