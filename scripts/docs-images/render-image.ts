import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Film } from '../../src/film/film'
import { toSrgb8 } from '../../src/film/tone-map'
import { renderBand } from '../../src/render/band'
import { createRenderSetup } from '../../src/render/settings'
import type { DocImage } from './images'
import { encodePng } from './png'

const BAND_ROWS = 16

/**
 * renders one image the way the browser's workers do - full-width bands, a random seed per
 * (pass, row) - just on a single thread, then writes it as `<name>.png` into `outDir`
 */
export function renderImage(image: DocImage, outDir: string): { samples: number; seconds: number } {
  const { width, height } = image.settings
  const { scene, integrator } = createRenderSetup(image.settings)
  const film = new Film(width, height)
  const start = performance.now()
  const seconds = () => (performance.now() - start) / 1000
  const done = (pass: number) =>
    'samples' in image.stop ? pass >= image.stop.samples : seconds() >= image.stop.seconds

  let pass = 0
  while (!done(pass)) {
    for (let firstRow = 0; firstRow < height; firstRow += BAND_ROWS) {
      const rowCount = Math.min(BAND_ROWS, height - firstRow)
      const band = renderBand(scene, integrator, width, { pass, firstRow, rowCount })
      film.addBand(firstRow, rowCount, band.sums)
      film.addSplatList(band.splatList())
    }
    pass++
  }

  const { pixels, width: outWidth, height: outHeight } = toPixels(film, image)
  writeFileSync(join(outDir, `${image.name}.png`), encodePng(outWidth, outHeight, pixels))
  return { samples: pass, seconds: seconds() }
}

/** tone-mapped 8-bit RGB, with the image's exposure and crop applied */
function toPixels(
  film: Film,
  image: DocImage,
): { pixels: Uint8Array; width: number; height: number } {
  const crop = image.crop ?? { x: 0, y: 0, width: film.width, height: film.height, scale: 1 }
  const exposure = image.exposure ?? 1
  const width = crop.width * crop.scale
  const height = crop.height * crop.scale
  const pixels = new Uint8Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = film.average(
        crop.x + Math.floor(x / crop.scale),
        crop.y + Math.floor(y / crop.scale),
      )
      const index = (y * width + x) * 3
      pixels[index] = toSrgb8(color.r * exposure)
      pixels[index + 1] = toSrgb8(color.g * exposure)
      pixels[index + 2] = toSrgb8(color.b * exposure)
    }
  }
  return { pixels, width, height }
}
