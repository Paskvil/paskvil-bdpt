import type { SampleSink } from '../film/sample-sink'
import { Color } from '../math/color'
import { Ray, RAY_EPSILON } from '../math/ray'
import type { Vec3 } from '../math/vec3'
import type { Random } from '../rng/random'
import type { Hit, Scene } from '../scene/scene'
import type { Integrator } from './integrator'

export interface PathTracerOptions {
  /** max number of bounces - a path has at most `maxDepth + 1` segments */
  maxDepth: number
}

/** paths shorter than this are never cut short by Russian roulette */
const ROULETTE_MIN_DEPTH = 3

/**
 * unidirectional path tracer with next event estimation (NEE)
 *
 * at every non-specular hit a light is sampled directly (a shadow ray); the path then continues
 * in a direction sampled from the BSDF. Light that the continuing path hits by chance is only
 * counted where NEE couldn't have found it - straight from the camera and after a specular
 * bounce - otherwise it would be counted twice
 */
export class PathTracer implements Integrator {
  constructor(
    private readonly scene: Scene,
    private readonly options: PathTracerOptions,
  ) {}

  renderSample(x: number, y: number, sink: SampleSink, random: Random): void {
    const ray = this.scene.camera.generateRay(x + random.next(), y + random.next())
    sink.addSample(x, y, this.radiance(ray, random))
  }

  radiance(cameraRay: Ray, random: Random): Color {
    let ray = cameraRay
    let radiance = Color.BLACK
    let throughput = Color.WHITE
    let countEmitted = true

    for (let depth = 0; depth <= this.options.maxDepth; depth++) {
      const hit = this.scene.intersect(ray)
      if (!hit) break

      const wo = ray.direction.negated()
      const { material, light } = hit.object

      if (countEmitted && light) {
        radiance = radiance.add(throughput.mul(light.emitted(hit.normal, wo)))
      }

      if (!material.isDelta) {
        radiance = radiance.add(throughput.mul(this.directLight(hit, wo, random)))
      }

      const scattered = material.sample(wo, hit.normal, random)
      if (!scattered || scattered.pdf === 0) break

      const cosine = Math.abs(scattered.direction.dot(hit.normal))
      throughput = throughput.mul(scattered.value).scale(cosine / scattered.pdf)
      countEmitted = scattered.isDelta

      if (depth >= ROULETTE_MIN_DEPTH) {
        const survival = Math.min(throughput.maxComponent(), 0.95)
        if (random.next() >= survival) break
        throughput = throughput.scale(1 / survival)
      }

      ray = Ray.spawn(hit.point, hit.normal, scattered.direction)
    }

    return radiance
  }

  /** NEE - one light picked uniformly, one point on it, one shadow ray */
  private directLight(hit: Hit, wo: Vec3, random: Random): Color {
    const lights = this.scene.lights
    if (lights.length === 0) return Color.BLACK

    const light = lights[Math.floor(random.next() * lights.length)]
    const sample = light.sampleIncoming(hit.point, random)
    if (!sample) return Color.BLACK

    const f = hit.object.material.evaluate(wo, sample.direction, hit.normal)
    if (f.isBlack()) return Color.BLACK

    const shadowRay = Ray.spawn(hit.point, hit.normal, sample.direction)
    // stop just short of the light itself, it would otherwise count as the occluder
    if (!this.scene.isUnoccluded(shadowRay, sample.distance - 2 * RAY_EPSILON)) return Color.BLACK

    const cosine = Math.abs(sample.direction.dot(hit.normal))
    const pickPdf = 1 / lights.length
    return f.mul(sample.radiance).scale(cosine / (sample.pdf * pickPdf))
  }
}
