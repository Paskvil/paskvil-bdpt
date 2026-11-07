import { Color } from '../../math/color'
import { Ray } from '../../math/ray'
import type { Random } from '../../rng/random'
import type { Scene } from '../../scene/scene'
import { misWeight, type MisHeuristic, type MisVertex } from './mis'
import { PathVertex } from './path-vertex'

export interface Contribution {
  /** MIS-weighted radiance */
  radiance: Color
  /** set for t = 1 only: where the path is seen on the film - the radiance goes there as a splat */
  filmPosition: { x: number; y: number } | null
}

/**
 * strategy (s, t): the first `s` vertices of the light subpath joined to the first `t` vertices
 * of the camera subpath
 *
 * - s = 0: the camera subpath itself hit a light
 * - t = 1: the light subpath is connected straight to the camera (light tracing) - lands anywhere
 *   on the film
 * - s = 1: the camera subpath is connected to a freshly sampled point on a light (= NEE)
 * - otherwise: the two subpath ends are joined by a shadow ray
 *
 * returns `null` when the strategy contributes nothing for these subpaths
 */
export function connect(
  scene: Scene,
  lightPath: readonly PathVertex[],
  cameraPath: readonly PathVertex[],
  s: number,
  t: number,
  heuristic: MisHeuristic,
  random: Random,
): Contribution | null {
  let lightEnd = s > 0 ? lightPath[s - 1] : null
  let cameraEnd = cameraPath[t - 1]
  let radiance: Color
  let filmPosition: Contribution['filmPosition'] = null

  if (s === 0) {
    radiance = cameraEnd.beta.mul(cameraEnd.emittedToward(cameraPath[t - 2]))
  } else if (t === 1) {
    if (!lightEnd || lightEnd.isDelta) return null
    const toCamera = connectToCamera(scene, lightEnd)
    if (!toCamera) return null
    cameraEnd = toCamera.vertex
    filmPosition = toCamera.filmPosition
    radiance = lightEnd.beta
      .mul(lightEnd.bsdf(cameraEnd))
      .mul(cameraEnd.beta)
      .scale(lightEnd.cosineToward(cameraEnd))
  } else if (s === 1) {
    if (cameraEnd.isDelta) return null
    lightEnd = sampleLightVertex(scene, cameraEnd, random)
    if (!lightEnd) return null
    radiance = cameraEnd.beta
      .mul(cameraEnd.bsdf(lightEnd))
      .mul(lightEnd.beta)
      .scale(cameraEnd.cosineToward(lightEnd))
  } else {
    if (!lightEnd || lightEnd.isDelta || cameraEnd.isDelta) return null
    radiance = lightEnd.beta
      .mul(lightEnd.bsdf(cameraEnd))
      .mul(cameraEnd.bsdf(lightEnd))
      .mul(cameraEnd.beta)
      .scale(geometryTerm(lightEnd, cameraEnd))
  }

  if (radiance.isBlack()) return null
  if (s > 0 && lightEnd && !isVisible(scene, lightEnd, cameraEnd)) return null

  const misPath = buildMisPath(scene, lightPath, cameraPath, s, t, lightEnd, cameraEnd)
  return { radiance: radiance.scale(misWeight(misPath, s, heuristic)), filmPosition }
}

/** t = 1: the camera as a vertex seen from `lightEnd`, with beta = We / pdf */
function connectToCamera(
  scene: Scene,
  lightEnd: PathVertex,
): { vertex: PathVertex; filmPosition: { x: number; y: number } } | null {
  const { camera } = scene
  const filmPosition = camera.filmPosition(lightEnd.point)
  if (!filmPosition) return null

  const toPoint = lightEnd.point.sub(camera.position)
  const distanceSquared = toPoint.lengthSquared()
  const direction = toPoint.scale(1 / Math.sqrt(distanceSquared))
  // pinhole: one fixed point, so the pdf of "sampling" it, per solid angle at lightEnd, is d² / cos
  const pdf = distanceSquared / direction.dot(camera.forward)
  const beta = Color.WHITE.scale(camera.importance(direction) / pdf)
  return { vertex: PathVertex.camera(camera, beta), filmPosition }
}

/** s = 1: a point on a light, sampled as seen from `cameraEnd`, with beta = Le / pdf */
function sampleLightVertex(scene: Scene, cameraEnd: PathVertex, random: Random): PathVertex | null {
  const picked = scene.pickLight(random)
  if (!picked) return null
  const sample = picked.light.sampleIncoming(cameraEnd.point, random)
  if (!sample) return null

  const beta = sample.radiance.scale(1 / (sample.pdf * picked.probability))
  const vertex = PathVertex.light(picked.light, sample.point, sample.normal, beta)
  vertex.pdfForward = picked.probability * picked.light.positionPdf()
  return vertex
}

/** G(a, b) = |cos θa| · |cos θb| / distance² - how well two points "see" each other */
function geometryTerm(a: PathVertex, b: PathVertex): number {
  const distanceSquared = a.point.sub(b.point).lengthSquared()
  return (a.cosineToward(b) * b.cosineToward(a)) / distanceSquared
}

function isVisible(scene: Scene, from: PathVertex, to: PathVertex): boolean {
  const { ray, distance } = Ray.between(from.point, from.surfaceNormal, to.point, to.surfaceNormal)
  return scene.isUnoccluded(ray, distance)
}

/**
 * the full path as MIS sees it - light end first, camera last
 *
 * the subpath vertices already know their pdfs from the random walks, except around the new
 * connection: there, the "other side" densities depend on the vertex across the connection
 */
function buildMisPath(
  scene: Scene,
  lightPath: readonly PathVertex[],
  cameraPath: readonly PathVertex[],
  s: number,
  t: number,
  lightEnd: PathVertex | null,
  cameraEnd: PathVertex,
): MisVertex[] {
  const lightVertex = (i: number) => (i === s - 1 && lightEnd ? lightEnd : lightPath[i])
  const cameraVertex = (i: number) => (i === t - 1 ? cameraEnd : cameraPath[i])

  const path: MisVertex[] = []
  for (let i = 0; i < s; i++) {
    const vertex = lightVertex(i)
    path.push({
      pdfFromLight: vertex.pdfForward,
      pdfFromCamera: vertex.pdfReverse,
      isDelta: vertex.isDelta,
    })
  }
  for (let i = t - 1; i >= 0; i--) {
    const vertex = cameraVertex(i)
    path.push({
      pdfFromLight: vertex.pdfReverse,
      pdfFromCamera: vertex.pdfForward,
      isDelta: vertex.isDelta,
    })
  }

  // indices into `path`: light end at s - 1, camera end at s
  const lightBeforeEnd = s > 1 ? lightPath[s - 2] : null
  const cameraBeforeEnd = t > 1 ? cameraPath[t - 2] : null

  path[s].pdfFromLight = lightEnd
    ? lightEnd.pdfTo(lightBeforeEnd, cameraEnd)
    : lightOriginPdf(scene, cameraEnd)
  if (cameraBeforeEnd) {
    path[s + 1].pdfFromLight = lightEnd
      ? cameraEnd.pdfTo(lightEnd, cameraBeforeEnd)
      : cameraEnd.emissionPdfTo(cameraBeforeEnd)
  }
  if (lightEnd) {
    path[s - 1].pdfFromCamera = cameraEnd.pdfTo(cameraBeforeEnd, lightEnd)
  }
  if (lightEnd && lightBeforeEnd) {
    path[s - 2].pdfFromCamera = lightEnd.pdfTo(cameraEnd, lightBeforeEnd)
  }
  return path
}

/** s = 0: the density of a light subpath starting exactly at the light point the camera path hit */
function lightOriginPdf(scene: Scene, vertex: PathVertex): number {
  const emitter = vertex.emitter
  return emitter ? scene.lightPickProbability() * emitter.positionPdf() : 0
}
