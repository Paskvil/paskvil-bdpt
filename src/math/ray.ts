import type { Vec3 } from './vec3'

/**
 * how far a spawned ray starts off its surface - avoids the ray hitting the surface it starts on
 * ("shadow acne"); the scene is ~1 unit across, so this is well below any visible detail
 */
export const RAY_EPSILON = 1e-4

export class Ray {
  /** `direction` is expected to be normalized */
  constructor(
    readonly origin: Vec3,
    readonly direction: Vec3,
  ) {}

  /** a ray leaving a surface point, nudged off the surface to the side it's heading to */
  static spawn(point: Vec3, normal: Vec3, direction: Vec3): Ray {
    const side = direction.dot(normal) > 0 ? RAY_EPSILON : -RAY_EPSILON
    return new Ray(point.add(normal.scale(side)), direction)
  }

  at(distance: number): Vec3 {
    return this.origin.add(this.direction.scale(distance))
  }
}
