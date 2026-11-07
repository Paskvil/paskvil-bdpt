import { expect } from 'vitest'
import { Film } from '../film/film'
import { vec3 } from '../math/vec3'
import { Sfc32 } from '../rng/random'
import { Camera } from '../scene/camera'
import { createCornellBox, type BallMaterials } from '../scene/cornell-box'
import { Scene } from '../scene/scene'
import type { Integrator } from './integrator'

/** test-only - rendering images and comparing them statistically */

export function renderPixels(
  integrator: Integrator,
  size: number,
  samplesPerPixel: number,
  seed: number,
): Film {
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
export function blockMean(film: Film, x0: number, y0: number, blockSize: number): number[] {
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

/**
 * the demo's Cornell box, but looking down at the floor - shadows, colour bleeding, light from
 * every panel, yet no panel in view: pixels covering a radiance-10 panel edge are far too noisy
 * to compare at test sample counts
 */
export function cornellBoxFloorView(size: number, balls: BallMaterials): Scene {
  const lights = { top: true, left: true, right: true }
  const box = createCornellBox({ lights, topShade: false, balls, width: size, height: size })
  const camera = new Camera(vec3(0.5, 0.7, 0.95), vec3(0.5, 0, 0.4), 40, size, size)
  return new Scene(box.objects, camera)
}

/**
 * how many standard errors two unbiased renders may differ by, per block and channel
 *
 * with just a handful of batches the standard error is itself only a rough estimate, so the
 * ratio follows a t distribution with heavy tails, not a normal one - at 6 batches each a
 * difference beyond 6 standard errors happens by chance in ~0.5% of test runs (with all the
 * blocks and channels checked), while a real bias shows up as tens of them
 */
const ALLOWED_STANDARD_ERRORS = 6

/**
 * expects two sets of independent batches of the same scene to show the same image - block by
 * block, within their noise, estimated from the spread between batches; no tolerances to tune,
 * and it works whichever of the two is the noisy one
 */
export function expectSameImage(reference: Film[], candidate: Film[], blockSize: number): void {
  const { width, height } = reference[0]
  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      const expected = blockStatistics(reference, x, y, blockSize)
      const actual = blockStatistics(candidate, x, y, blockSize)
      for (let channel = 0; channel < 3; channel++) {
        const difference = Math.abs(actual.mean[channel] - expected.mean[channel])
        const standardError = Math.hypot(
          actual.standardError[channel],
          expected.standardError[channel],
        )
        // + a tiny floor, for blocks so smooth that the batches agree almost exactly
        expect(difference, `block (${x}, ${y}), channel ${channel}`).toBeLessThan(
          ALLOWED_STANDARD_ERRORS * standardError + 1e-3,
        )
      }
    }
  }
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
