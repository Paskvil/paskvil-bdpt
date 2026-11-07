import { describe, expect, it } from 'vitest'
import { Film } from '../../film/film'
import type { Scene } from '../../scene/scene'
import { Bdpt } from '../bdpt/bdpt'
import { PathTracer } from '../path-tracer'
import { blockMean, cornellBoxFloorView, expectSameImage, renderPixels } from '../test-images'
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

  /** as for BDPT: independent batches, compared within their noise */
  it.each([
    { left: 'diffuse', right: 'diffuse' },
    { left: 'mirror', right: 'glass' },
  ] as const)(
    'matches the path tracer on the Cornell box, balls %o',
    (balls) => {
      const size = 16
      const batches = 6
      const scene = cornellBoxFloorView(size, balls)
      const pathTraced = Array.from({ length: batches }, (_, batch) =>
        renderPixels(new PathTracer(scene, { maxDepth: 5 }), size, 1000, batch),
      )
      const metropolis = Array.from({ length: batches }, (_, batch) =>
        renderMlt(scene, size, 100, 100 + batch),
      )
      expectSameImage(pathTraced, metropolis, 4)
    },
    120_000,
  )
})
