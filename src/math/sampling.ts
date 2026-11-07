import { Vec3 } from './vec3'

/**
 * cosine-weighted direction on the hemisphere around +z, from two uniform numbers in [0, 1);
 * the matching pdf (per solid angle) is `cosineHemispherePdf`
 */
export function sampleCosineHemisphere(u1: number, u2: number): Vec3 {
  const radius = Math.sqrt(u1)
  const phi = 2 * Math.PI * u2
  return new Vec3(radius * Math.cos(phi), radius * Math.sin(phi), Math.sqrt(1 - u1))
}

export function cosineHemispherePdf(cosTheta: number): number {
  return cosTheta > 0 ? cosTheta / Math.PI : 0
}
