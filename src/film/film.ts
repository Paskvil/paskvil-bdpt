import { Color } from '../math/color'
import type { SampleSink } from './sample-sink'

/**
 * accumulates radiance samples per pixel; the image is the per-pixel average
 *
 * counts are kept per pixel because a progressive pass may be partly done when the image is shown
 */
export class Film implements SampleSink {
  private readonly sums: Float64Array
  private readonly counts: Uint32Array

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.sums = new Float64Array(width * height * 3)
    this.counts = new Uint32Array(width * height)
  }

  addSample(x: number, y: number, radiance: Color): void {
    const pixel = y * this.width + x
    this.sums[pixel * 3] += radiance.r
    this.sums[pixel * 3 + 1] += radiance.g
    this.sums[pixel * 3 + 2] += radiance.b
    this.counts[pixel] += 1
  }

  /** adds a rendered band - one sample for every pixel of rows `firstRow ..< firstRow + rowCount` */
  addBand(firstRow: number, rowCount: number, bandSums: Float32Array): void {
    const firstPixel = firstRow * this.width
    const pixelCount = rowCount * this.width
    for (let i = 0; i < pixelCount; i++) {
      const pixel = firstPixel + i
      this.sums[pixel * 3] += bandSums[i * 3]
      this.sums[pixel * 3 + 1] += bandSums[i * 3 + 1]
      this.sums[pixel * 3 + 2] += bandSums[i * 3 + 2]
      this.counts[pixel] += 1
    }
  }

  /** average number of samples per pixel so far */
  samplesPerPixel(): number {
    let total = 0
    for (const count of this.counts) total += count
    return total / this.counts.length
  }

  average(x: number, y: number): Color {
    const pixel = y * this.width + x
    const count = this.counts[pixel]
    if (count === 0) return Color.BLACK
    const scale = 1 / count
    return new Color(
      this.sums[pixel * 3] * scale,
      this.sums[pixel * 3 + 1] * scale,
      this.sums[pixel * 3 + 2] * scale,
    )
  }
}
