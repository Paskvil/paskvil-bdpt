import { Color } from '../../math/color'
import { Frame } from '../../math/frame'
import { cosineHemispherePdf, sampleCosineHemisphere } from '../../math/sampling'
import type { Vec3 } from '../../math/vec3'
import type { Random } from '../../rng/random'
import type { BsdfSample, Material } from './material'

/**
 * Lambertian - scatters equally in all directions, f = albedo / π
 *
 * two-sided: reflects on whichever side `wo` is, so quads don't need to face the right way to look right
 */
export class Diffuse implements Material {
  readonly isDelta = false

  constructor(readonly albedo: Color) {}

  evaluate(wo: Vec3, wi: Vec3, normal: Vec3): Color {
    return sameSide(wo, wi, normal) ? this.albedo.scale(1 / Math.PI) : Color.BLACK
  }

  sample(wo: Vec3, normal: Vec3, random: Random): BsdfSample | null {
    const facing = facingNormal(wo, normal)
    const local = sampleCosineHemisphere(random.next(), random.next())
    const direction = Frame.fromNormal(facing).toWorld(local)
    return {
      direction,
      value: this.albedo.scale(1 / Math.PI),
      pdf: cosineHemispherePdf(local.z),
      isDelta: false,
    }
  }

  pdf(wo: Vec3, wi: Vec3, normal: Vec3): number {
    return sameSide(wo, wi, normal) ? cosineHemispherePdf(Math.abs(wi.dot(normal))) : 0
  }
}

function facingNormal(wo: Vec3, normal: Vec3): Vec3 {
  return wo.dot(normal) < 0 ? normal.negated() : normal
}

function sameSide(wo: Vec3, wi: Vec3, normal: Vec3): boolean {
  return wo.dot(normal) * wi.dot(normal) > 0
}
