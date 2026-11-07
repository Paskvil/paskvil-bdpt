import { Color } from '../../math/color'
import type { Vec3 } from '../../math/vec3'
import type { AreaLight } from '../../scene/area-light'
import type { Camera } from '../../scene/camera'
import type { Material } from '../../scene/materials/material'
import type { Hit } from '../../scene/scene'

/**
 * which quantity a subpath carries - matters for BSDFs that aren't symmetric (refraction):
 * camera subpaths carry radiance towards the camera, light subpaths carry importance towards lights
 */
export type Transport = 'radiance' | 'importance'

type VertexKind =
  | { type: 'camera'; camera: Camera }
  | { type: 'light'; light: AreaLight }
  | { type: 'surface'; material: Material; light: AreaLight | null }

/**
 * one vertex of a camera or light subpath (Veach's thesis ch. 10, PBRT's BDPT chapter)
 *
 * - `beta` is the subpath throughput up to here (radiance or importance carried, divided by the
 *   pdf of generating the subpath so far)
 * - `pdfForward` - density *per area* of this vertex having been sampled by its own subpath
 *   (from the previous vertex), `pdfReverse` - the same if the path had been generated from the
 *   other end; MIS compares the two, see mis.ts
 */
export class PathVertex {
  pdfForward = 0
  pdfReverse = 0
  /** scattered by a delta BSDF - can't be connected to, its pdfs are 0 */
  isDelta = false

  private constructor(
    readonly kind: VertexKind,
    readonly point: Vec3,
    /** surface normal; the emitting side for a light, the viewing direction for the camera */
    readonly normal: Vec3,
    readonly beta: Color,
    readonly transport: Transport,
    /** unit direction back to the previous vertex of the same subpath, `null` at its start */
    readonly towardPrevious: Vec3 | null,
  ) {}

  static camera(camera: Camera, beta: Color): PathVertex {
    return new PathVertex(
      { type: 'camera', camera },
      camera.position,
      camera.forward,
      beta,
      'radiance',
      null,
    )
  }

  static light(light: AreaLight, point: Vec3, normal: Vec3, beta: Color): PathVertex {
    return new PathVertex({ type: 'light', light }, point, normal, beta, 'importance', null)
  }

  static surface(hit: Hit, beta: Color, transport: Transport, towardPrevious: Vec3): PathVertex {
    const kind: VertexKind = {
      type: 'surface',
      material: hit.object.material,
      light: hit.object.light ?? null,
    }
    return new PathVertex(kind, hit.point, hit.normal, beta, transport, towardPrevious)
  }

  /** the light this vertex emits from - a light subpath's start, or a surface that is a light */
  get emitter(): AreaLight | null {
    switch (this.kind.type) {
      case 'light':
        return this.kind.light
      case 'surface':
        return this.kind.light
      case 'camera':
        return null
    }
  }

  /** the normal of the surface this vertex is on - `null` for the camera, which has none */
  get surfaceNormal(): Vec3 | null {
    return this.kind.type === 'camera' ? null : this.normal
  }

  directionTo(other: PathVertex): Vec3 {
    return other.point.sub(this.point).normalized()
  }

  /**
   * BSDF value for light passing through this surface vertex between its previous vertex and
   * `next` - in the direction the subpath's quantity flows (see `Transport`)
   */
  bsdf(next: PathVertex): Color {
    if (this.kind.type !== 'surface' || !this.towardPrevious) return Color.BLACK
    const towardNext = this.directionTo(next)
    return this.transport === 'radiance'
      ? this.kind.material.evaluate(this.towardPrevious, towardNext, this.normal)
      : this.kind.material.evaluate(towardNext, this.towardPrevious, this.normal)
  }

  /** radiance this vertex emits towards `target` */
  emittedToward(target: PathVertex): Color {
    return this.emitter?.emitted(this.normal, this.directionTo(target)) ?? Color.BLACK
  }

  /** |cos| between the normal and the direction to `other` - 1 for the camera (no surface) */
  cosineToward(other: PathVertex): number {
    if (this.kind.type === 'camera') return 1
    return Math.abs(this.normal.dot(this.directionTo(other)))
  }

  /**
   * density (per area, at `next`) of this vertex sampling `next` as the following vertex, having
   * been reached from `previous` - `previous` is ignored at the start of a subpath
   */
  pdfTo(previous: PathVertex | null, next: PathVertex): number {
    const direction = this.directionTo(next)
    let pdfPerSolidAngle: number

    switch (this.kind.type) {
      case 'camera':
        pdfPerSolidAngle = this.kind.camera.directionPdf(direction)
        break
      case 'light':
        pdfPerSolidAngle = this.kind.light.emissionDirectionPdf(this.normal, direction)
        break
      case 'surface':
        if (!previous) return 0
        pdfPerSolidAngle = this.kind.material.pdf(
          this.directionTo(previous),
          direction,
          this.normal,
        )
        break
    }
    return next.solidAngleToArea(pdfPerSolidAngle, this)
  }

  /** density (per area, at `next`) of a light emitting from this point towards `next` */
  emissionPdfTo(next: PathVertex): number {
    const emitter = this.emitter
    if (!emitter) return 0
    const pdf = emitter.emissionDirectionPdf(this.normal, this.directionTo(next))
    return next.solidAngleToArea(pdf, this)
  }

  /**
   * converts a pdf per solid angle, as seen from `from`, into a pdf per area at this vertex:
   * dω = |cos θ| dA / distance²
   */
  solidAngleToArea(pdfPerSolidAngle: number, from: PathVertex): number {
    const distanceSquared = this.point.sub(from.point).lengthSquared()
    return (pdfPerSolidAngle * this.cosineToward(from)) / distanceSquared
  }
}
