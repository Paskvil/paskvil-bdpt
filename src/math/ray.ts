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

  /**
   * shadow ray from one point to another - each end nudged off its surface (when it has one)
   * towards the other point, and the ray aimed between the nudged points
   *
   * nudging only the origin (as `spawn` does) would shift the whole line sideways: near the target
   * it would pass up to `RAY_EPSILON` beside it - possibly inside the target's own object
   */
  static between(
    from: Vec3,
    fromNormal: Vec3 | null,
    to: Vec3,
    toNormal: Vec3 | null,
  ): { ray: Ray; distance: number } {
    const origin = nudgeToward(from, fromNormal, to)
    const target = nudgeToward(to, toNormal, from)
    const toTarget = target.sub(origin)
    const distance = toTarget.length()
    return { ray: new Ray(origin, toTarget.scale(1 / distance)), distance }
  }

  at(distance: number): Vec3 {
    return this.origin.add(this.direction.scale(distance))
  }
}

/** moves a surface point off its surface, to the side `toward` is on */
function nudgeToward(point: Vec3, normal: Vec3 | null, toward: Vec3): Vec3 {
  if (!normal) return point
  const side = toward.sub(point).dot(normal) > 0 ? RAY_EPSILON : -RAY_EPSILON
  return point.add(normal.scale(side))
}
