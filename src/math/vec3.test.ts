import { describe, expect, it } from 'vitest'
import { vec3 } from './vec3'

describe('Vec3', () => {
  it('cross product is right-handed', () => {
    const z = vec3(1, 0, 0).cross(vec3(0, 1, 0))
    expect(z).toEqual(vec3(0, 0, 1))
  })

  it('normalized has unit length', () => {
    expect(vec3(3, -4, 12).normalized().length()).toBeCloseTo(1, 12)
  })
})
