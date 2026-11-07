import { Color } from '../../math/color'
import type { Vec3 } from '../../math/vec3'
import type { BsdfSample, Material } from './material'

/** perfect mirror - reflects every ray in exactly one direction (a delta BSDF) */
export class Mirror implements Material {
  readonly isDelta = true

  constructor(readonly reflectance: Color) {}

  /** zero for any given pair of directions - only `sample` can find the one that reflects */
  evaluate(): Color {
    return Color.BLACK
  }

  sample(wo: Vec3, normal: Vec3): BsdfSample {
    const direction = reflect(wo, normal)
    const cosine = Math.abs(direction.dot(normal))
    // delta: `value · |cos| / pdf` must come out as the reflectance
    return { direction, value: this.reflectance.scale(1 / cosine), pdf: 1, isDelta: true }
  }

  pdf(): number {
    return 0
  }
}

/** mirror direction of `wo` about the normal - works from either side */
export function reflect(wo: Vec3, normal: Vec3): Vec3 {
  return normal.scale(2 * wo.dot(normal)).sub(wo)
}
