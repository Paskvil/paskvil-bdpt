import type { Ray } from '../../math/ray'
import type { Vec3 } from '../../math/vec3'

/** a point picked on a shape's surface */
export interface SurfacePoint {
  point: Vec3
  normal: Vec3
}

/** geometry only - what a surface looks like is up to its material */
export interface Shape {
  readonly area: number

  /** distance along the ray to the nearest hit in (0, maxDistance), or `null` */
  intersect(ray: Ray, maxDistance: number): number | null

  /** outward-facing unit normal at a point on the surface */
  normalAt(point: Vec3): Vec3

  /** uniformly distributed point on the surface (pdf = 1 / area), from two numbers in [0, 1) */
  sampleUniform(u1: number, u2: number): SurfacePoint
}
