import { describe, expect, it } from 'vitest'
import { PathTracer } from '../path-tracer'
import { blockMean, cornellBoxFloorView, expectSameImage, renderPixels } from '../test-images'
import { createFurnace, furnaceRadiance } from '../test-scenes'
import { Bdpt } from './bdpt'

const BATCHES = 6

describe('Bdpt', () => {
  describe.each(['balance', 'power', 'uniform'] as const)('%s heuristic', (heuristic) => {
    it.each([0, 0.5])('converges to Le / (1 - albedo) in a furnace, albedo %s', (albedo) => {
      const size = 4
      const scene = createFurnace(1, albedo, size)
      const film = renderPixels(new Bdpt(scene, { maxDepth: 30, heuristic }), size, 300, 5)

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
    const bdpt = new Bdpt(scene, { maxDepth: 30, heuristic: 'power', only })
    const film = renderPixels(bdpt, size, 300, 9)

    const [red] = blockMean(film, 0, 0, size)
    expect(red).toBeCloseTo(albedo ** (s + t - 2), 1)
  })

  // with glass, the path tracer is the noisy one: it only finds the caustic under the glass ball
  // by hitting a light by chance - hence more reference samples there
  it.each([
    { balls: { left: 'diffuse', right: 'diffuse' }, referenceSamples: 300 },
    { balls: { left: 'mirror', right: 'glass' }, referenceSamples: 1000 },
  ] as const)(
    'matches the path tracer on the Cornell box, balls $balls',
    ({ balls, referenceSamples }) => {
      const size = 16
      const maxDepth = 5
      const scene = cornellBoxFloorView(size, balls)
      const pathTraced = Array.from({ length: BATCHES }, (_, batch) =>
        renderPixels(new PathTracer(scene, { maxDepth }), size, referenceSamples, batch),
      )
      const bidirectional = Array.from({ length: BATCHES }, (_, batch) =>
        renderPixels(new Bdpt(scene, { maxDepth, heuristic: 'power' }), size, 60, 100 + batch),
      )
      expectSameImage(pathTraced, bidirectional, 4)
    },
    90_000, // renders ~7k samples per pixel in total
  )
})
