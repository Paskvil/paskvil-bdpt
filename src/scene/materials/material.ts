import type { Color } from '../../math/color'
import type { Vec3 } from '../../math/vec3'
import type { Random } from '../../rng/random'

/**
 * a direction picked by a material
 *
 * - `value` is the BSDF value f(wo, wi) - for delta (perfectly specular) materials it already
 *   includes the delta's weight, so `value · |cos| / pdf` is the throughput factor either way
 */
export interface BsdfSample {
  direction: Vec3
  value: Color
  pdf: number
  isDelta: boolean
}

/**
 * how light scatters at a surface (the BSDF)
 *
 * conventions (as in PBRT): all directions are unit, in world space, and point *away* from the
 * surface - `wo` towards where the light goes (the camera side), `wi` towards where it comes from
 */
export interface Material {
  /** true when the BSDF is a delta distribution (mirror, glass) - it can't be evaluated or connected to */
  readonly isDelta: boolean

  evaluate(wo: Vec3, wi: Vec3, normal: Vec3): Color

  sample(wo: Vec3, normal: Vec3, random: Random): BsdfSample | null

  /** pdf (per solid angle) of `sample` picking `wi` */
  pdf(wo: Vec3, wi: Vec3, normal: Vec3): number
}
