import { describe, expect, it } from 'vitest'
import { Ray } from '../../math/ray'
import { vec3 } from '../../math/vec3'
import { Sfc32 } from '../../rng/random'
import { Quad } from './quad'
import { Sphere } from './sphere'

describe('Sphere', () => {
  const sphere = new Sphere(vec3(0, 0, 0), 2)

  it('hits the near side from outside, the far side from inside', () => {
    expect(sphere.intersect(new Ray(vec3(0, 0, 5), vec3(0, 0, -1)), Infinity)).toBeCloseTo(3)
    expect(sphere.intersect(new Ray(vec3(0, 0, 0), vec3(0, 0, -1)), Infinity)).toBeCloseTo(2)
  })

  it('misses, and respects maxDistance', () => {
    expect(sphere.intersect(new Ray(vec3(0, 3, 5), vec3(0, 0, -1)), Infinity)).toBeNull()
    expect(sphere.intersect(new Ray(vec3(0, 0, 5), vec3(0, 0, -1)), 2.5)).toBeNull()
  })

  it('samples points on the surface with outward normals', () => {
    const random = new Sfc32(3)
    for (let i = 0; i < 100; i++) {
      const { point, normal } = sphere.sampleUniform(random.next(), random.next())
      expect(point.length()).toBeCloseTo(2, 9)
      expect(normal.sub(point.scale(1 / 2)).length()).toBeCloseTo(0, 9)
    }
  })
})

describe('Quad', () => {
  // unit square in the z = 0 plane, facing +z
  const quad = new Quad(vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0))

  it('faces edgeU × edgeV, area is |edgeU × edgeV|', () => {
    expect(quad.normal).toEqual(vec3(0, 0, 1))
    expect(new Quad(vec3(0, 0, 0), vec3(2, 0, 0), vec3(0, 3, 0)).area).toBeCloseTo(6)
  })

  it('hits inside, misses outside', () => {
    const down = vec3(0, 0, -1)
    expect(quad.intersect(new Ray(vec3(0.5, 0.5, 1), down), Infinity)).toBeCloseTo(1)
    expect(quad.intersect(new Ray(vec3(1.5, 0.5, 1), down), Infinity)).toBeNull()
    expect(quad.intersect(new Ray(vec3(0.5, -0.1, 1), down), Infinity)).toBeNull()
  })

  it('is hit from both sides', () => {
    expect(quad.intersect(new Ray(vec3(0.5, 0.5, -1), vec3(0, 0, 1)), Infinity)).toBeCloseTo(1)
  })

  it('centered() puts the centre where asked', () => {
    const panel = Quad.centered(vec3(1, 2, 3), vec3(0.5, 0, 0), vec3(0, 0.5, 0))
    expect(panel.corner).toEqual(vec3(0.75, 1.75, 3))
  })
})
