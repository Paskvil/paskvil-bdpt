import { describe, expect, it } from 'vitest'
import { Color } from '../../math/color'
import { vec3 } from '../../math/vec3'
import { Sfc32 } from '../../rng/random'
import { fresnelDielectric, Glass } from './glass'
import { Mirror } from './mirror'

const UP = vec3(0, 1, 0)
/** `value · |cos| / pdf` - what a sample multiplies the path throughput by */
function weight(sample: { value: Color; pdf: number; direction: typeof UP }, normal = UP): Color {
  return sample.value.scale(Math.abs(sample.direction.dot(normal)) / sample.pdf)
}

describe('Mirror', () => {
  const mirror = new Mirror(Color.gray(0.9))

  it('reflects about the normal, keeping the reflectance', () => {
    const wo = vec3(1, 1, 0).normalized()
    const sample = mirror.sample(wo, UP)
    expect(sample.direction.sub(vec3(-1, 1, 0).normalized()).length()).toBeCloseTo(0, 12)
    expect(weight(sample).r).toBeCloseTo(0.9, 12)
  })

  it('cannot be evaluated - it is a delta', () => {
    expect(mirror.evaluate()).toEqual(Color.BLACK)
    expect(mirror.pdf()).toBe(0)
  })
})

describe('fresnelDielectric', () => {
  it('reflects ~4% at normal incidence on glass, all of it past the critical angle', () => {
    expect(fresnelDielectric(1, 1, 1.5)).toBeCloseTo(0.04, 4)
    const pastCritical = Math.cos(Math.asin(1 / 1.5) + 0.01)
    expect(fresnelDielectric(pastCritical, 1.5, 1)).toBe(1)
  })
})

describe('Glass', () => {
  const glass = new Glass(1.5)
  const random = new Sfc32(1)

  it('refracts by Snell: sin θt = sin θi / 1.5 entering', () => {
    const wo = vec3(Math.sin(0.5), Math.cos(0.5), 0)
    for (let i = 0; i < 50; i++) {
      const sample = glass.sample(wo, UP, random, 'radiance')
      if (sample.direction.y > 0) continue // reflected
      expect(Math.abs(sample.direction.x)).toBeCloseTo(Math.sin(0.5) / 1.5, 12)
      expect(sample.direction.length()).toBeCloseTo(1, 12)
    }
  })

  it('scales refracted radiance by (η_i / η_t)², importance not at all', () => {
    const wo = vec3(0, 1, 0)
    for (let i = 0; i < 50; i++) {
      const radiance = glass.sample(wo, UP, random, 'radiance')
      if (radiance.direction.y < 0) expect(weight(radiance).r).toBeCloseTo(1 / 2.25, 12)
      const importance = glass.sample(wo, UP, random, 'importance')
      if (importance.direction.y < 0) expect(weight(importance).r).toBeCloseTo(1, 12)
    }
  })

  it('reflects with probability F, each branch at full weight (energy conserving)', () => {
    const wo = vec3(Math.sin(1.2), Math.cos(1.2), 0)
    let reflected = 0
    const count = 50_000
    for (let i = 0; i < count; i++) {
      const sample = glass.sample(wo, UP, random, 'importance')
      if (sample.direction.y > 0) {
        reflected++
        expect(weight(sample).r).toBeCloseTo(1, 12)
      }
    }
    expect(reflected / count).toBeCloseTo(fresnelDielectric(Math.cos(1.2), 1, 1.5), 2)
  })

  it('reflects totally from inside, past the critical angle', () => {
    const insideNormal = UP // the ray is below the surface, coming from inside
    const wo = vec3(Math.sin(1.0), -Math.cos(1.0), 0) // 57° > critical 41.8°
    for (let i = 0; i < 50; i++) {
      expect(glass.sample(wo, insideNormal, random, 'radiance').direction.y).toBeLessThan(0)
    }
  })
})
