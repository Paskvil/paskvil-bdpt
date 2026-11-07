import { Vec3 } from './vec3'

/**
 * orthonormal basis around a normal - converts directions between world space and a local
 * space where the normal is +z, which is where BSDFs and hemisphere sampling are simplest
 */
export class Frame {
  private constructor(
    readonly tangent: Vec3,
    readonly bitangent: Vec3,
    readonly normal: Vec3,
  ) {}

  /** branchless construction from Duff et al., "Building an Orthonormal Basis, Revisited" (2017) */
  static fromNormal(normal: Vec3): Frame {
    const sign = Math.sign(normal.z) || 1
    const a = -1 / (sign + normal.z)
    const b = normal.x * normal.y * a
    const tangent = new Vec3(1 + sign * normal.x * normal.x * a, sign * b, -sign * normal.x)
    const bitangent = new Vec3(b, sign + normal.y * normal.y * a, -normal.y)
    return new Frame(tangent, bitangent, normal)
  }

  toWorld(local: Vec3): Vec3 {
    return this.tangent
      .scale(local.x)
      .add(this.bitangent.scale(local.y))
      .add(this.normal.scale(local.z))
  }

  toLocal(world: Vec3): Vec3 {
    return new Vec3(world.dot(this.tangent), world.dot(this.bitangent), world.dot(this.normal))
  }
}
