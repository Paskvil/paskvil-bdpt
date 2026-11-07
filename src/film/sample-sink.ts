import type { Color } from '../math/color'

/** where an integrator puts its samples - the whole film, or one band of it in a worker */
export interface SampleSink {
  /** one camera sample for pixel (x, y) */
  addSample(x: number, y: number, radiance: Color): void
}
