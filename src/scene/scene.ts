import type { Ray } from '../math/ray'
import type { Vec3 } from '../math/vec3'
import type { AreaLight } from './area-light'
import type { Camera } from './camera'
import type { Material } from './materials/material'
import type { Shape } from './shapes/shape'

export interface SceneObject {
  /** for debugging and tests - "floor", "left ball", ... */
  name: string
  shape: Shape
  material: Material
  light?: AreaLight
}

export interface Hit {
  distance: number
  point: Vec3
  normal: Vec3
  object: SceneObject
}

/**
 * a handful of objects tested one by one - no acceleration structure, the demo scene is tiny
 */
export class Scene {
  readonly lights: readonly AreaLight[]

  constructor(
    readonly objects: readonly SceneObject[],
    readonly camera: Camera,
  ) {
    this.lights = objects.flatMap((object) => (object.light ? [object.light] : []))
  }

  intersect(ray: Ray, maxDistance = Infinity): Hit | null {
    let nearest: { distance: number; object: SceneObject } | null = null
    for (const object of this.objects) {
      const distance = object.shape.intersect(ray, nearest?.distance ?? maxDistance)
      if (distance !== null) nearest = { distance, object }
    }
    if (!nearest) return null

    const point = ray.at(nearest.distance)
    return { ...nearest, point, normal: nearest.object.shape.normalAt(point) }
  }

  /** true when nothing blocks the ray before `distance` - shadow rays */
  isUnoccluded(ray: Ray, distance: number): boolean {
    return this.objects.every((object) => object.shape.intersect(ray, distance) === null)
  }
}
