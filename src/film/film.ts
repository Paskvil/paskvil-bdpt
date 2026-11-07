import { Color } from '../math/color'
import type { SampleSink } from './sample-sink'

/**
 * accumulates radiance samples per pixel; the image is the per-pixel average plus the splats
 *
 * - counts are kept per pixel because a progressive pass may be partly done when the image is shown
 * - splats (BDPT light tracing) land anywhere, so they're scaled by the *total* sample count: every
 *   sample traced one light path, and the light-tracing estimate for a pixel is
 *   (sum of its splats) · (pixel count) / (light path count) - see `Camera.importance`
 */
export class Film implements SampleSink {
  private readonly sums: Float64Array
  private readonly counts: Uint32Array
  private readonly splats: Float64Array
  private totalSamples = 0

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.sums = new Float64Array(width * height * 3)
    this.counts = new Uint32Array(width * height)
    this.splats = new Float64Array(width * height * 3)
  }

  addSample(x: number, y: number, radiance: Color): void {
    const pixel = y * this.width + x
    this.sums[pixel * 3] += radiance.r
    this.sums[pixel * 3 + 1] += radiance.g
    this.sums[pixel * 3 + 2] += radiance.b
    this.counts[pixel] += 1
    this.totalSamples += 1
  }

  addSplat(filmX: number, filmY: number, radiance: Color): void {
    const pixel = Math.floor(filmY) * this.width + Math.floor(filmX)
    this.splats[pixel * 3] += radiance.r
    this.splats[pixel * 3 + 1] += radiance.g
    this.splats[pixel * 3 + 2] += radiance.b
  }

  /** adds splats in the `[pixel index, r, g, b, ...]` layout of `SplatList` */
  addSplatList(splatList: Float32Array): void {
    for (let i = 0; i < splatList.length; i += 4) {
      const pixel = splatList[i]
      this.splats[pixel * 3] += splatList[i + 1]
      this.splats[pixel * 3 + 1] += splatList[i + 2]
      this.splats[pixel * 3 + 2] += splatList[i + 3]
    }
  }

  /**
   * counts samples that put all their light into splats - PSSMLT's mutations: they don't belong to
   * any pixel, but the splats are averaged over them
   */
  addSplatOnlySamples(count: number): void {
    this.totalSamples += count
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
    this.totalSamples += pixelCount
  }

  /** camera samples so far, over all pixels - also the number of light paths (one per sample) */
  get sampleCount(): number {
    return this.totalSamples
  }

  /** average number of samples per pixel so far */
  samplesPerPixel(): number {
    return this.totalSamples / this.counts.length
  }

  average(x: number, y: number): Color {
    const pixel = y * this.width + x
    if (this.totalSamples === 0) return Color.BLACK

    // a pixel may have splats but no camera samples of its own (PSSMLT, or a pass in progress)
    const count = this.counts[pixel]
    const sampleScale = count > 0 ? 1 / count : 0
    const splatScale = this.counts.length / this.totalSamples
    return new Color(
      this.sums[pixel * 3] * sampleScale + this.splats[pixel * 3] * splatScale,
      this.sums[pixel * 3 + 1] * sampleScale + this.splats[pixel * 3 + 1] * splatScale,
      this.sums[pixel * 3 + 2] * sampleScale + this.splats[pixel * 3 + 2] * splatScale,
    )
  }
}
