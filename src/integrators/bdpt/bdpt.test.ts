import { describe, expect, it } from 'vitest'
import { Film } from '../../film/film'
import { vec3 } from '../../math/vec3'
import { Sfc32 } from '../../rng/random'
import { Camera } from '../../scene/camera'
import { createCornellBox, type BallMaterials } from '../../scene/cornell-box'
import { Scene } from '../../scene/scene'
import type { Integrator } from '../integrator'
import { PathTracer } from '../path-tracer'
import { createFurnace, furnaceRadiance } from '../test-scenes'
import { Bdpt } from './bdpt'

function render(integrator: Integrator, size: number, samplesPerPixel: number, seed: number): Film {
  const film = new Film(size, size)
  const random = new Sfc32(seed)
  for (let pass = 0; pass < samplesPerPixel; pass++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) integrator.renderSample(x, y, film, random)
    }
  }
  return film
}

/** mean of the red, green, blue channels over a block of pixels */
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

/**
 * the demo's Cornell box, but looking down at the floor - shadows, colour bleeding, light from
 * every panel, yet no panel in view: pixels covering a radiance-10 panel edge are far too noisy
 * to compare at test sample counts
 */
function cornellBoxFloorView(size: number, balls: BallMaterials): Scene {
  const lights = { top: true, left: true, right: true }
  const box = createCornellBox({ lights, balls, width: size, height: size })
  const camera = new Camera(vec3(0.5, 0.7, 0.95), vec3(0.5, 0, 0.4), 40, size, size)
  return new Scene(box.objects, camera)
}

describe('Bdpt', () => {
  describe.each(['balance', 'power', 'uniform'] as const)('%s heuristic', (heuristic) => {
    it.each([0, 0.5])('converges to Le / (1 - albedo) in a furnace, albedo %s', (albedo) => {
      const size = 4
      const scene = createFurnace(1, albedo, size)
      const film = render(new Bdpt(scene, { maxDepth: 30, heuristic }), size, 300, 5)

      const [red] = blockMean(film, 0, 0, size)
      expect(red).toBeCloseTo(furnaceRadiance(1, albedo), 1)
    })
  })

  // light that bounced exactly k times has radiance Le · albedo^k in the furnace - and each
  // strategy alone, unweighted, estimates all light along paths of its length (bounces = s + t - 2)
  it.each([
    [0, 3],
    [1, 2],
    [2, 1],
    [0, 4],
    [2, 2],
    [3, 1],
  ])('strategy (%i, %i) alone, unweighted, estimates its path length in a furnace', (s, t) => {
    const size = 4
    const albedo = 0.5
    const scene = createFurnace(1, albedo, size)
    const only = { s, t, weighted: false }
    const film = render(new Bdpt(scene, { maxDepth: 30, heuristic: 'power', only }), size, 300, 9)

    const [red] = blockMean(film, 0, 0, size)
    expect(red).toBeCloseTo(albedo ** (s + t - 2), 1)
  })

  /**
   * both integrators render the scene in independent batches; per block of pixels, the spread
   * between batches estimates the standard error of the mean - the two means must agree within
   * 4 standard errors (a real bias shows up as tens of them, noise as ~1)
   *
   * with glass, the path tracer is the noisy one: it only finds the caustic under the glass ball
   * by hitting a light by chance - hence more reference samples there
   */
  it.each([
    { balls: { left: 'diffuse', right: 'diffuse' }, referenceSamples: 300 },
    { balls: { left: 'mirror', right: 'glass' }, referenceSamples: 1000 },
  ] as const)(
    'matches the path tracer on the Cornell box, balls $balls',
    ({ balls, referenceSamples }) => {
      const size = 16
      const blockSize = 4
      const maxDepth = 5
      const batches = 5
      const scene = cornellBoxFloorView(size, balls)
      const pathTraced = Array.from({ length: batches }, (_, batch) =>
        render(new PathTracer(scene, { maxDepth }), size, referenceSamples, batch),
      )
      const bidirectional = Array.from({ length: batches }, (_, batch) =>
        render(new Bdpt(scene, { maxDepth, heuristic: 'power' }), size, 60, 100 + batch),
      )

      for (let y = 0; y < size; y += blockSize) {
        for (let x = 0; x < size; x += blockSize) {
          const expected = blockStatistics(pathTraced, x, y, blockSize)
          const actual = blockStatistics(bidirectional, x, y, blockSize)
          for (let channel = 0; channel < 3; channel++) {
            const error = Math.abs(actual.mean[channel] - expected.mean[channel])
            const standardError = Math.hypot(
              actual.standardError[channel],
              expected.standardError[channel],
            )
            // + a tiny floor, for blocks so smooth that the batches agree almost exactly
            expect(error, `block (${x}, ${y}), channel ${channel}`).toBeLessThan(
              4 * standardError + 1e-3,
            )
          }
        }
      }
    },
    60_000, // renders ~6k samples per pixel in total
  )
})
