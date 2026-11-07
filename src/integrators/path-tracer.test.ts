import { describe, expect, it } from 'vitest'
import { Sfc32 } from '../rng/random'
import { PathTracer } from './path-tracer'
import { createFurnace, furnaceRadiance } from './test-scenes'

describe('PathTracer', () => {
  it.each([0, 0.5, 0.8])('converges to Le / (1 - albedo) in a furnace, albedo %s', (albedo) => {
    const scene = createFurnace(1, albedo, 1)
    const tracer = new PathTracer(scene, { maxDepth: 50 })
    const random = new Sfc32(11)

    const samples = 20_000
    let sum = 0
    for (let i = 0; i < samples; i++) {
      const ray = scene.camera.generateRay(random.next(), random.next())
      sum += tracer.radiance(ray, random).r
    }

    expect(sum / samples).toBeCloseTo(furnaceRadiance(1, albedo), 1)
  })
})
