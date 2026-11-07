import { Color } from '../math/color'
import { vec3 } from '../math/vec3'
import { AreaLight } from '../scene/area-light'
import { Camera } from '../scene/camera'
import { Diffuse } from '../scene/materials/diffuse'
import { Scene } from '../scene/scene'
import { Quad } from '../scene/shapes/quad'

/**
 * test-only scene - "furnace": a closed box whose walls all emit `Le` and reflect `albedo`;
 * every point sees the same radiance everywhere, L = Le + albedo · L, so L = Le / (1 - albedo)
 *
 * catches double-counted or missing light (between strategies), wrong pdfs, cosine terms...
 */
export function createFurnace(emitted: number, albedo: number, filmSize: number): Scene {
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
  const camera = new Camera(vec3(0.5, 0.5, 0.5), vec3(0.3, 0.4, 0), 60, filmSize, filmSize)
  return new Scene(objects, camera)
}

export function furnaceRadiance(emitted: number, albedo: number): number {
  return emitted / (1 - albedo)
}
