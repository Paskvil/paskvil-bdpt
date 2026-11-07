/** immutable 3D vector - points, directions and normals */
export class Vec3 {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
  ) {}

  static readonly ZERO = new Vec3(0, 0, 0)

  add(other: Vec3): Vec3 {
    return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z)
  }

  sub(other: Vec3): Vec3 {
    return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z)
  }

  scale(factor: number): Vec3 {
    return new Vec3(this.x * factor, this.y * factor, this.z * factor)
  }

  negated(): Vec3 {
    return new Vec3(-this.x, -this.y, -this.z)
  }

  dot(other: Vec3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z
  }

  cross(other: Vec3): Vec3 {
    return new Vec3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    )
  }

  lengthSquared(): number {
    return this.dot(this)
  }

  length(): number {
    return Math.sqrt(this.lengthSquared())
  }

  normalized(): Vec3 {
    return this.scale(1 / this.length())
  }
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return new Vec3(x, y, z)
}
