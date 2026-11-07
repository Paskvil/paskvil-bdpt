import { Color } from '../../math/color'
import { Ray } from '../../math/ray'
import type { Random } from '../../rng/random'
import type { Scene } from '../../scene/scene'
import type { Transport } from '../../scene/materials/material'
import { PathVertex } from './path-vertex'

/**
 * camera subpath through film position (filmX, filmY): the camera, then up to `maxVertices - 1`
 * surface vertices
 */
export function generateCameraSubpath(
  scene: Scene,
  filmX: number,
  filmY: number,
  maxVertices: number,
  random: Random,
): PathVertex[] {
  const { camera } = scene
  const ray = camera.generateRay(filmX, filmY)

  // the camera ray's throughput, We · cos / (pdfPosition · pdfDirection), is exactly 1 for a pinhole
  const start = PathVertex.camera(camera, Color.WHITE)
  start.pdfForward = 1
  const path = [start]

  const pdfDirection = camera.directionPdf(ray.direction)
  randomWalk(scene, ray, Color.WHITE, pdfDirection, 'radiance', maxVertices, random, path)
  return path
}

/**
 * light subpath: a point on a light, then up to `maxVertices - 1` surface vertices - empty when
 * there's no light to start from
 */
export function generateLightSubpath(
  scene: Scene,
  maxVertices: number,
  random: Random,
): PathVertex[] {
  const picked = scene.pickLight(random)
  if (!picked) return []
  const { light, probability } = picked

  const { point, normal } = light.shape.sampleUniform(random.next(), random.next())
  const pdfPosition = probability * light.positionPdf()
  const start = PathVertex.light(light, point, normal, light.radiance.scale(1 / pdfPosition))
  start.pdfForward = pdfPosition
  const path = [start]

  const direction = light.sampleEmissionDirection(normal, random)
  const pdfDirection = light.emissionDirectionPdf(normal, direction)
  if (pdfDirection === 0) return path

  const cosine = Math.abs(normal.dot(direction))
  const beta = start.beta.scale(cosine / pdfDirection)
  const ray = Ray.spawn(point, normal, direction)
  randomWalk(scene, ray, beta, pdfDirection, 'importance', maxVertices, random, path)
  return path
}

/**
 * extends `path` by following `ray` and sampling BSDFs, until it leaves the scene, gets absorbed,
 * or has `maxVertices` vertices; fills in each vertex's forward pdf, and the reverse pdf of the
 * vertex before it
 */
function randomWalk(
  scene: Scene,
  startRay: Ray,
  startBeta: Color,
  startPdfDirection: number,
  transport: Transport,
  maxVertices: number,
  random: Random,
  path: PathVertex[],
): void {
  let ray = startRay
  let beta = startBeta
  let pdfForwardPerSolidAngle = startPdfDirection

  while (path.length < maxVertices) {
    const hit = scene.intersect(ray)
    if (!hit) return

    const previous = path[path.length - 1]
    const vertex = PathVertex.surface(hit, beta, transport, ray.direction.negated())
    vertex.pdfForward = vertex.solidAngleToArea(pdfForwardPerSolidAngle, previous)
    path.push(vertex)
    if (path.length === maxVertices) return

    const { material } = hit.object
    const towardPrevious = ray.direction.negated()
    const scattered = material.sample(towardPrevious, hit.normal, random, transport)
    if (!scattered || scattered.pdf === 0) return

    const cosine = Math.abs(scattered.direction.dot(hit.normal))
    beta = beta.mul(scattered.value).scale(cosine / scattered.pdf)
    if (beta.isBlack()) return

    // how likely the walk in the other direction would have come from here to `previous`
    let pdfReversePerSolidAngle = material.pdf(scattered.direction, towardPrevious, hit.normal)
    pdfForwardPerSolidAngle = scattered.pdf
    if (scattered.isDelta) {
      vertex.isDelta = true
      pdfForwardPerSolidAngle = 0
      pdfReversePerSolidAngle = 0
    }
    previous.pdfReverse = previous.solidAngleToArea(pdfReversePerSolidAngle, vertex)

    ray = Ray.spawn(hit.point, hit.normal, scattered.direction)
  }
}
