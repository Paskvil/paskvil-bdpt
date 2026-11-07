import { describe, expect, it } from 'vitest'
import { Sfc32 } from '../rng/random'
import { sampleCosineHemisphere } from './sampling'

describe('sampleCosineHemisphere', () => {
  it('returns unit directions in the upper hemisphere, E[cos θ] = 2/3', () => {
    const random = new Sfc32(7)
    const count = 100_000
    let cosineSum = 0
    for (let i = 0; i < count; i++) {
      const direction = sampleCosineHemisphere(random.next(), random.next())
      expect(direction.z).toBeGreaterThanOrEqual(0)
      expect(direction.length()).toBeCloseTo(1, 9)
      cosineSum += direction.z
    }
    expect(cosineSum / count).toBeCloseTo(2 / 3, 2)
  })
})
