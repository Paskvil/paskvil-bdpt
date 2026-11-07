import type { Ray } from '../../math/ray'
import type { Vec3 } from '../../math/vec3'
import type { Shape, SurfacePoint } from './shape'

/**
 * parallelogram spanned by two edges from a corner: `corner + a·edgeU + b·edgeV`, a, b in [0, 1]
 *
 * the normal is `edgeU × edgeV` - the edge order decides which way the quad faces
 */
export class Quad implements Shape {
  readonly normal: Vec3
  readonly area: number
  /** `n / |n|²` for the unnormalized normal n - turns a hit point into (a, b), see `intersect` */
  private readonly inverseNormal: Vec3

  constructor(
    readonly corner: Vec3,
    readonly edgeU: Vec3,
    readonly edgeV: Vec3,
  ) {
    const n = edgeU.cross(edgeV)
    this.area = n.length()
    this.normal = n.scale(1 / this.area)
    this.inverseNormal = n.scale(1 / n.lengthSquared())
  }

  /** square-ish panel given by its centre and two full-length edges */
  static centered(center: Vec3, edgeU: Vec3, edgeV: Vec3): Quad {
    const corner = center.sub(edgeU.scale(0.5)).sub(edgeV.scale(0.5))
    return new Quad(corner, edgeU, edgeV)
  }

  intersect(ray: Ray, maxDistance: number): number | null {
    const denominator = this.normal.dot(ray.direction)
    if (Math.abs(denominator) < 1e-12) return null // parallel to the plane

    const t = this.corner.sub(ray.origin).dot(this.normal) / denominator
    if (t <= 0 || t >= maxDistance) return null

    // express the hit point in edge coordinates, inside iff both are in [0, 1]
    const local = ray.at(t).sub(this.corner)
    const a = this.inverseNormal.dot(local.cross(this.edgeV))
    const b = this.inverseNormal.dot(this.edgeU.cross(local))
    return a >= 0 && a <= 1 && b >= 0 && b <= 1 ? t : null
  }

  normalAt(): Vec3 {
    return this.normal
  }

  sampleUniform(u1: number, u2: number): SurfacePoint {
    const point = this.corner.add(this.edgeU.scale(u1)).add(this.edgeV.scale(u2))
    return { point, normal: this.normal }
  }
}
