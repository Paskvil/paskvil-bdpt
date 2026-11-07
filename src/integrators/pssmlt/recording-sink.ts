import type { SampleSink } from '../../film/sample-sink'
import type { Color } from '../../math/color'

/** a bit of light one sample put on the film */
export interface Contribution {
  filmX: number
  filmY: number
  radiance: Color
}

/**
 * catches everything one sample of the wrapped integrator puts on the film - its own pixel's
 * value and any splats - so PSSMLT can weigh it before it goes on the real film
 */
export class RecordingSink implements SampleSink {
  readonly contributions: Contribution[] = []
  /** the chain's target function: how bright the sample is in total */
  luminance = 0

  addSample(x: number, y: number, radiance: Color): void {
    // the pixel's own value lands in the middle of the pixel
    this.record(x + 0.5, y + 0.5, radiance)
  }

  addSplat(filmX: number, filmY: number, radiance: Color): void {
    this.record(filmX, filmY, radiance)
  }

  private record(filmX: number, filmY: number, radiance: Color): void {
    if (radiance.isBlack()) return
    this.contributions.push({ filmX, filmY, radiance })
    this.luminance += radiance.luminance()
  }
}
