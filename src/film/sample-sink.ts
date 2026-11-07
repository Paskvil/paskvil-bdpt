import type { Color } from '../math/color'

/** where an integrator puts its samples - the whole film, or one band of it in a worker */
export interface SampleSink {
  /** one camera sample for pixel (x, y) - each call counts as one more sample of that pixel */
  addSample(x: number, y: number, radiance: Color): void

  /**
   * light that a light path brought to an arbitrary film position (BDPT's light tracing) - not a
   * sample of its own: the film divides all splats by the total number of samples (= light paths)
   */
  addSplat(filmX: number, filmY: number, radiance: Color): void
}
