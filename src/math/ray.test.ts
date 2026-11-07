import { describe, expect, it } from 'vitest'
import { Sfc32 } from '../rng/random'
import { Sphere } from '../scene/shapes/sphere'
import { Ray } from './ray'
import { vec3 } from './vec3'

describe('Ray.between', () => {
  it('a sphere never blocks the view of its own lit side', () => {
    // regression: nudging only the origin shifted the whole line, which then clipped the sphere
    // just before reaching the target - 25% of light→ball shadow rays in the Cornell box
    const sphere = new Sphere(vec3(0.68, 0.45, 0.65), 1 / 6)
    const light = vec3(0.999, 0.5, 0.75)
    const lightNormal = vec3(-1, 0, 0)
    const random = new Sfc32(1)

    for (let i = 0; i < 2000; i++) {
      const { point, normal } = sphere.sampleUniform(random.next(), random.next())
      if (light.sub(point).dot(normal) <= 0) continue // faces away from the light

      const { ray, distance } = Ray.between(light, lightNormal, point, normal)
      expect(sphere.intersect(ray, distance)).toBeNull()
    }
  })

  it('leaves an end without a normal (the camera) where it is', () => {
    const { ray, distance } = Ray.between(vec3(0, 0, 0), null, vec3(0, 0, 2), null)
    expect(ray.origin).toEqual(vec3(0, 0, 0))
    expect(distance).toBeCloseTo(2)
  })
})
