import type { SampleSink } from '../../film/sample-sink'
import { Color } from '../../math/color'
import type { Random } from '../../rng/random'
import type { Scene } from '../../scene/scene'
import type { Integrator } from '../integrator'
import { connect } from './connect'
import type { MisHeuristic } from './mis'
import { generateCameraSubpath, generateLightSubpath } from './subpaths'

export interface BdptOptions {
  /** max number of bounces - same meaning as for the path tracer */
  maxDepth: number
  heuristic: MisHeuristic
}

/**
 * bidirectional path tracer (Veach 1997, ch. 10)
 *
 * per pixel sample: trace one subpath from the camera and one from a light, then join every
 * prefix of one with every prefix of the other - each (s, t) pair is a separate strategy for
 * building a path with s light vertices and t camera vertices. Every strategy is a complete,
 * unbiased estimator on its own; MIS weights blend them so each path is mostly counted by the
 * strategy that samples it best
 */
export class Bdpt implements Integrator {
  constructor(
    private readonly scene: Scene,
    private readonly options: BdptOptions,
  ) {}

  renderSample(x: number, y: number, sink: SampleSink, random: Random): void {
    const { maxDepth, heuristic } = this.options
    // a path with `maxDepth` bounces has `maxDepth + 2` vertices, camera and light included
    const cameraPath = generateCameraSubpath(
      this.scene,
      x + random.next(),
      y + random.next(),
      maxDepth + 2,
      random,
    )
    const lightPath = generateLightSubpath(this.scene, maxDepth + 1, random)

    let radiance = Color.BLACK
    for (let t = 1; t <= cameraPath.length; t++) {
      for (let s = 0; s <= lightPath.length; s++) {
        const bounces = s + t - 2
        if (bounces < 0 || bounces > maxDepth || (s === 1 && t === 1)) continue

        const contribution = connect(this.scene, lightPath, cameraPath, s, t, heuristic, random)
        if (!contribution) continue

        if (contribution.filmPosition) {
          const { x: filmX, y: filmY } = contribution.filmPosition
          sink.addSplat(filmX, filmY, contribution.radiance)
        } else {
          radiance = radiance.add(contribution.radiance)
        }
      }
    }
    sink.addSample(x, y, radiance)
  }
}
