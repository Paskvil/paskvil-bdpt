import { describe, expect, it } from 'vitest'
import { Frame } from './frame'
import { vec3 } from './vec3'

const NORMALS = [vec3(0, 0, 1), vec3(0, 0, -1), vec3(1, 0, 0), vec3(0.3, -0.5, 0.8).normalized()]

describe('Frame', () => {
  it.each(NORMALS)('is orthonormal around %o', (normal) => {
    const { tangent, bitangent } = Frame.fromNormal(normal)
    expect(tangent.length()).toBeCloseTo(1, 12)
    expect(bitangent.length()).toBeCloseTo(1, 12)
    expect(tangent.dot(bitangent)).toBeCloseTo(0, 12)
    expect(tangent.dot(normal)).toBeCloseTo(0, 12)
    expect(bitangent.dot(normal)).toBeCloseTo(0, 12)
  })

  it('maps local +z to the normal and back', () => {
    const normal = vec3(0.3, -0.5, 0.8).normalized()
    const frame = Frame.fromNormal(normal)
    const world = frame.toWorld(vec3(0, 0, 1))
    expect(world.sub(normal).length()).toBeCloseTo(0, 12)
    expect(frame.toLocal(world).z).toBeCloseTo(1, 12)
  })
})
