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
 * which quantity a path carries - matters for BSDFs that aren't symmetric (refraction):
 * paths from the camera carry radiance, paths from a light carry importance (PBRT's TransportMode)
 */
export type Transport = 'radiance' | 'importance'

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

  /**
   * picks a new direction for a path that arrived from `wo` - for a camera path that's where the
   * light goes, for a light path where it came from; `transport` says which
   */
  sample(wo: Vec3, normal: Vec3, random: Random, transport: Transport): BsdfSample | null

  /** pdf (per solid angle) of `sample` picking `wi` */
  pdf(wo: Vec3, wi: Vec3, normal: Vec3): number
}
