import { describe, expect, it } from 'vitest'
import { Color } from '../math/color'
import { vec3 } from '../math/vec3'
import { Sfc32 } from '../rng/random'
import { AreaLight } from '../scene/area-light'
import { Camera } from '../scene/camera'
import { Diffuse } from '../scene/materials/diffuse'
import { Scene } from '../scene/scene'
import { Quad } from '../scene/shapes/quad'
import { PathTracer } from './path-tracer'

/**
 * "furnace": a closed box whose walls all emit `Le` and reflect `albedo` - every point sees the
 * same radiance everywhere, L = Le + albedo · L, so L = Le / (1 - albedo)
 *
 * catches double-counted or missing light (NEE vs. hitting emitters), wrong pdfs, cosine terms...
 */
function furnace(emitted: number, albedo: number): Scene {
  const x = vec3(1, 0, 0)
  const y = vec3(0, 1, 0)
  const z = vec3(0, 0, 1)
  const origin = vec3(0, 0, 0)
  const faces = [
    new Quad(origin, z, x), // floor
    new Quad(y, x, z), // ceiling
    new Quad(origin, x, y), // back
    new Quad(z, y, x), // front
    new Quad(origin, y, z), // left
    new Quad(x, z, y), // right
  ]
  const material = new Diffuse(Color.gray(albedo))
  const objects = faces.map((quad, index) => ({
    name: `face ${index}`,
    shape: quad,
    material,
    light: new AreaLight(quad, Color.gray(emitted)),
  }))
  const camera = new Camera(vec3(0.5, 0.5, 0.5), vec3(0.3, 0.4, 0), 60, 1, 1)
  return new Scene(objects, camera)
}

describe('PathTracer', () => {
  it.each([0, 0.5, 0.8])('converges to Le / (1 - albedo) in a furnace, albedo %s', (albedo) => {
    const scene = furnace(1, albedo)
    const tracer = new PathTracer(scene, { maxDepth: 50 })
    const random = new Sfc32(11)

    const samples = 20_000
    let sum = 0
    for (let i = 0; i < samples; i++) {
      const ray = scene.camera.generateRay(random.next(), random.next())
      sum += tracer.radiance(ray, random).r
    }

    expect(sum / samples).toBeCloseTo(1 / (1 - albedo), 1)
  })
})
