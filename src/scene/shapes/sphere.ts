import type { Ray } from '../../math/ray'
import { Vec3 } from '../../math/vec3'
import type { Shape, SurfacePoint } from './shape'

export class Sphere implements Shape {
  readonly area: number

  constructor(
    readonly center: Vec3,
    readonly radius: number,
  ) {
    this.area = 4 * Math.PI * radius * radius
  }

  intersect(ray: Ray, maxDistance: number): number | null {
    // solve |origin + t·direction - center|² = radius² for t (direction is unit length)
    const toOrigin = ray.origin.sub(this.center)
    const halfB = toOrigin.dot(ray.direction)
    const c = toOrigin.lengthSquared() - this.radius * this.radius
    const discriminant = halfB * halfB - c
    if (discriminant < 0) return null

    const root = Math.sqrt(discriminant)
    for (const t of [-halfB - root, -halfB + root]) {
      if (t > 0 && t < maxDistance) return t
    }
    return null
  }

  normalAt(point: Vec3): Vec3 {
    return point.sub(this.center).scale(1 / this.radius)
  }

  sampleUniform(u1: number, u2: number): SurfacePoint {
    const z = 1 - 2 * u1
    const ring = Math.sqrt(Math.max(0, 1 - z * z))
    const phi = 2 * Math.PI * u2
    const normal = new Vec3(ring * Math.cos(phi), ring * Math.sin(phi), z)
    return { point: this.center.add(normal.scale(this.radius)), normal }
  }
}
