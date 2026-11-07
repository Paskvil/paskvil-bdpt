import type { Color } from '../math/color'

/** somewhere to put light that lands at an arbitrary film position */
export interface SplatSink {
  /**
   * light that a path brought to an arbitrary film position (BDPT's light tracing, PSSMLT) - not
   * a sample of its own: the film divides all splats by the total number of samples
   */
  addSplat(filmX: number, filmY: number, radiance: Color): void
}

/** where an integrator puts its samples - the whole film, or one band of it in a worker */
export interface SampleSink extends SplatSink {
  /** one camera sample for pixel (x, y) - each call counts as one more sample of that pixel */
  addSample(x: number, y: number, radiance: Color): void
}
