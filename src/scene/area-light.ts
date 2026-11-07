import { Color } from '../math/color'
import type { Vec3 } from '../math/vec3'
import type { Random } from '../rng/random'
import type { Shape } from './shapes/shape'

/** a light arriving at a point from a sampled point on a light */
export interface LightSample {
  point: Vec3
  /** unit direction from the receiving point towards the light */
  direction: Vec3
  distance: number
  radiance: Color
  /** pdf per solid angle, as seen from the receiving point */
  pdf: number
}

/** emitter with the same radiance everywhere on its surface, on the side its normal faces */
export class AreaLight {
  constructor(
    readonly shape: Shape,
    readonly radiance: Color,
  ) {}

  /** radiance leaving `point` in direction `wo` */
  emitted(normal: Vec3, wo: Vec3): Color {
    return normal.dot(wo) > 0 ? this.radiance : Color.BLACK
  }

  /** picks a point on the light uniformly by area, for light arriving at `receiver` */
  sampleIncoming(receiver: Vec3, random: Random): LightSample | null {
    const { point, normal } = this.shape.sampleUniform(random.next(), random.next())
    const toLight = point.sub(receiver)
    const distance = toLight.length()
    const direction = toLight.scale(1 / distance)

    const cosAtLight = -direction.dot(normal)
    if (cosAtLight <= 0) return null // looking at the light's back

    // convert the area pdf (1 / area) to solid angle as seen from the receiver
    const pdf = (distance * distance) / (cosAtLight * this.shape.area)
    return { point, direction, distance, radiance: this.radiance, pdf }
  }
}
