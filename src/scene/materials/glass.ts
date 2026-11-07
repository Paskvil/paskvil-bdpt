import { Color } from '../../math/color'
import type { Vec3 } from '../../math/vec3'
import type { Random } from '../../rng/random'
import type { BsdfSample, Material, Transport } from './material'
import { reflect } from './mirror'

/**
 * clear dielectric (glass, water) - a smooth surface that both reflects and refracts
 *
 * the Fresnel term F says how much is reflected; `sample` reflects with probability F and refracts
 * otherwise, so each branch carries exactly its share of the light
 */
export class Glass implements Material {
  readonly isDelta = true

  /** `indexOfRefraction` of the inside, the outside (the normal's side) is air */
  constructor(readonly indexOfRefraction: number) {}

  evaluate(): Color {
    return Color.BLACK
  }

  sample(wo: Vec3, normal: Vec3, random: Random, transport: Transport): BsdfSample {
    const entering = wo.dot(normal) > 0
    const facing = entering ? normal : normal.negated()
    const etaOutside = entering ? 1 : this.indexOfRefraction // the side `wo` is on
    const etaInside = entering ? this.indexOfRefraction : 1 // the side across the surface
    const cosOutside = wo.dot(facing)

    const reflectance = fresnelDielectric(cosOutside, etaOutside, etaInside)
    if (random.next() < reflectance) {
      const direction = reflect(wo, facing)
      const value = Color.WHITE.scale(reflectance / Math.abs(direction.dot(normal)))
      return { direction, value, pdf: reflectance, isDelta: true }
    }

    // reflectance < 1 here, so it's not total internal reflection and `refract` succeeds
    const direction = refract(wo, facing, etaOutside / etaInside)
    const transmittance = 1 - reflectance
    // radiance gets squeezed into a smaller solid angle entering a denser medium (and spread out
    // leaving it); importance doesn't - the one asymmetry BDPT has to respect (Veach ch. 5).
    // In the demo it never shows: a path through a closed glass ball goes in and out again, so
    // the factors cancel - it would matter for e.g. a diffuse object under water
    const radianceScale = transport === 'radiance' ? (etaOutside / etaInside) ** 2 : 1
    const value = Color.WHITE.scale(
      (transmittance * radianceScale) / Math.abs(direction.dot(normal)),
    )
    return { direction, value, pdf: transmittance, isDelta: true }
  }

  pdf(): number {
    return 0
  }
}

/**
 * fraction of light reflected at a smooth dielectric boundary, unpolarized - `cosIncident` is on
 * the side with index `etaIncident`; 1 for total internal reflection
 */
export function fresnelDielectric(
  cosIncident: number,
  etaIncident: number,
  etaOther: number,
): number {
  const sinOther = (etaIncident / etaOther) * Math.sqrt(Math.max(0, 1 - cosIncident * cosIncident))
  if (sinOther >= 1) return 1

  const cosOther = Math.sqrt(Math.max(0, 1 - sinOther * sinOther))
  const parallel =
    (etaOther * cosIncident - etaIncident * cosOther) /
    (etaOther * cosIncident + etaIncident * cosOther)
  const perpendicular =
    (etaIncident * cosIncident - etaOther * cosOther) /
    (etaIncident * cosIncident + etaOther * cosOther)
  return (parallel * parallel + perpendicular * perpendicular) / 2
}

/** Snell's law: `wo` refracted through a surface facing it, `eta` = η(wo's side) / η(other side) */
function refract(wo: Vec3, facingNormal: Vec3, eta: number): Vec3 {
  const cosIncident = wo.dot(facingNormal)
  const sinSquaredOther = eta * eta * Math.max(0, 1 - cosIncident * cosIncident)
  const cosOther = Math.sqrt(1 - sinSquaredOther)
  return wo
    .negated()
    .scale(eta)
    .add(facingNormal.scale(eta * cosIncident - cosOther))
}
