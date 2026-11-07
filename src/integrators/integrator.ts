import type { Film } from '../film/film'
import type { Random } from '../rng/random'

/** turns the scene into pixel samples */
export interface Integrator {
  /**
   * adds one sample for pixel (x, y) to the film - an integrator may also add to other pixels
   * (BDPT's light-tracing strategy lands wherever the light path is seen from the camera)
   */
  renderSample(x: number, y: number, film: Film, random: Random): void
}
