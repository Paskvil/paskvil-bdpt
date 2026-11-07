import type { Color } from '../math/color'
import type { SplatSink } from './sample-sink'

/**
 * splats on their way from a worker to the film - few compared to the pixels, so a flat list of
 * `[pixel index, r, g, b, ...]` instead of a whole-film buffer (see `Film.addSplatList`)
 */
export class SplatList implements SplatSink {
  private readonly values: number[] = []

  constructor(private readonly width: number) {}

  addSplat(filmX: number, filmY: number, radiance: Color): void {
    const pixel = Math.floor(filmY) * this.width + Math.floor(filmX)
    this.values.push(pixel, radiance.r, radiance.g, radiance.b)
  }

  toFloat32Array(): Float32Array {
    return new Float32Array(this.values)
  }
}
