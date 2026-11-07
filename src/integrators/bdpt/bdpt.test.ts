import { describe, expect, it } from 'vitest'
import { Film } from '../../film/film'
import { vec3 } from '../../math/vec3'
import { Sfc32 } from '../../rng/random'
import { Camera } from '../../scene/camera'
import { createCornellBox } from '../../scene/cornell-box'
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

/**
 * the demo's Cornell box, but looking down at the floor - shadows, colour bleeding, light from
 * every panel, yet no panel in view: pixels covering a radiance-10 panel edge are far too noisy
 * to compare at test sample counts
 */
function cornellBoxFloorView(size: number): Scene {
  const lights = { top: true, left: true, right: true }
  const box = createCornellBox({ lights, width: size, height: size })
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

  it('matches the path tracer on the Cornell box', () => {
    const size = 16
    const blockSize = 4
    const maxDepth = 5
    const scene = cornellBoxFloorView(size)
    const pathTraced = render(new PathTracer(scene, { maxDepth }), size, 1500, 1)
    const bidirectional = render(new Bdpt(scene, { maxDepth, heuristic: 'power' }), size, 300, 2)

    for (let y = 0; y < size; y += blockSize) {
      for (let x = 0; x < size; x += blockSize) {
        const expected = blockMean(pathTraced, x, y, blockSize)
        const actual = blockMean(bidirectional, x, y, blockSize)
        for (let channel = 0; channel < 3; channel++) {
          // relative error, with an absolute floor for dark blocks - and for the occasional
          // firefly: where the left ball touches the floor, connections between two very close
          // points are BDPT's known weak spot (seeds spread ~±0.004 there)
          const tolerance = Math.max(0.05 * expected[channel], 0.015)
          const error = Math.abs(actual[channel] - expected[channel])
          expect(error, `block (${x}, ${y}), channel ${channel}`).toBeLessThan(tolerance)
        }
      }
    }
  })
})
