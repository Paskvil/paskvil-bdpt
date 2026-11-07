import { Color } from '../math/color'

/**
 * accumulates radiance samples per pixel; the image is the per-pixel average
 *
 * counts are kept per pixel because a progressive pass may be partly done when the image is shown
 */
export class Film {
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
