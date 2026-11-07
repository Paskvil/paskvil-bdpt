import { Ray } from '../math/ray'
import { Vec3 } from '../math/vec3'

/**
 * pinhole camera - film coordinates are in pixels, (0, 0) is the top-left corner
 *
 * for BDPT the camera is also a "sensor" that light paths can connect to - `importance` and
 * `directionPdf` describe it, normalized over the whole film (as in PBRT)
 */
export class Camera {
  readonly forward: Vec3
  private readonly right: Vec3
  private readonly up: Vec3
  private readonly tanHalfFov: number
  private readonly aspect: number
  /** area of the film rectangle placed at distance 1 in front of the pinhole */
  private readonly filmAreaAtUnitDistance: number

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
    this.aspect = width / height
    this.filmAreaAtUnitDistance = 2 * this.tanHalfFov * this.aspect * (2 * this.tanHalfFov)
  }

  generateRay(filmX: number, filmY: number): Ray {
    const screenX = ((2 * filmX) / this.width - 1) * this.tanHalfFov * this.aspect
    const screenY = (1 - (2 * filmY) / this.height) * this.tanHalfFov
    const direction = this.forward
      .add(this.right.scale(screenX))
      .add(this.up.scale(screenY))
      .normalized()
    return new Ray(this.position, direction)
  }

  /** where on the film a point is seen, in pixels - `null` when it's behind or outside the frame */
  filmPosition(point: Vec3): { x: number; y: number } | null {
    const toPoint = point.sub(this.position)
    const depth = toPoint.dot(this.forward)
    if (depth <= 0) return null

    const screenX = toPoint.dot(this.right) / depth / (this.tanHalfFov * this.aspect)
    const screenY = toPoint.dot(this.up) / depth / this.tanHalfFov
    const x = ((screenX + 1) / 2) * this.width
    const y = ((1 - screenY) / 2) * this.height
    const inside = x >= 0 && x < this.width && y >= 0 && y < this.height
    return inside ? { x, y } : null
  }

  /**
   * importance We emitted along `direction` (unit, from the pinhole) - 1 / (A · cos⁴θ),
   * so that it integrates to 1 over the film; zero outside the frame
   */
  importance(direction: Vec3): number {
    const cosine = direction.dot(this.forward)
    if (!this.filmPosition(this.position.add(direction))) return 0
    return 1 / (this.filmAreaAtUnitDistance * cosine ** 4)
  }

  /** pdf (per solid angle) of a camera ray in `direction`, sampled uniformly over the film */
  directionPdf(direction: Vec3): number {
    const cosine = direction.dot(this.forward)
    if (!this.filmPosition(this.position.add(direction))) return 0
    return 1 / (this.filmAreaAtUnitDistance * cosine ** 3)
  }
}
