import { Ray } from '../math/ray'
import { Vec3 } from '../math/vec3'

/** pinhole camera - film coordinates are in pixels, (0, 0) is the top-left corner */
export class Camera {
  private readonly forward: Vec3
  private readonly right: Vec3
  private readonly up: Vec3
  private readonly tanHalfFov: number

  constructor(
    readonly position: Vec3,
    lookAt: Vec3,
    verticalFovDegrees: number,
    readonly width: number,
    readonly height: number,
  ) {
    this.forward = lookAt.sub(position).normalized()
    this.right = this.forward.cross(new Vec3(0, 1, 0)).normalized()
    this.up = this.right.cross(this.forward)
    this.tanHalfFov = Math.tan((verticalFovDegrees * Math.PI) / 360)
  }

  generateRay(filmX: number, filmY: number): Ray {
    const aspect = this.width / this.height
    const screenX = ((2 * filmX) / this.width - 1) * this.tanHalfFov * aspect
    const screenY = (1 - (2 * filmY) / this.height) * this.tanHalfFov
    const direction = this.forward
      .add(this.right.scale(screenX))
      .add(this.up.scale(screenY))
      .normalized()
    return new Ray(this.position, direction)
  }
}
