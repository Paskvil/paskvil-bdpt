import type { Color } from '../math/color'
import type { Film } from './film'

/**
 * linear radiance → 8-bit sRGB: clamp to [0, 1] and apply the sRGB transfer curve
 *
 * deliberately the simplest mapping - bright spots (the lights) just clip to white
 */
export function writeToImageData(film: Film, image: ImageData): void {
  for (let y = 0; y < film.height; y++) {
    for (let x = 0; x < film.width; x++) {
      const offset = (y * film.width + x) * 4
      const color: Color = film.average(x, y)
      image.data[offset] = toSrgb8(color.r)
      image.data[offset + 1] = toSrgb8(color.g)
      image.data[offset + 2] = toSrgb8(color.b)
      image.data[offset + 3] = 255
    }
  }
}

export function toSrgb8(linear: number): number {
  const clamped = Math.min(Math.max(linear, 0), 1)
  const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
  return Math.round(encoded * 255)
}
