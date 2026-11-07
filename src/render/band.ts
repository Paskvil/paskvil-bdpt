import type { SampleSink } from '../film/sample-sink'
import type { Integrator } from '../integrators/integrator'
import type { Color } from '../math/color'
import { Sfc32 } from '../rng/random'
import type { Scene } from '../scene/scene'

/** a unit of work: one sample for every pixel of a few consecutive rows, in a given pass */
export interface BandJob {
  pass: number
  firstRow: number
  rowCount: number
}

/**
 * the result of one band, ready to transfer
 *
 * - camera samples: plain RGB triples, row by row
 * - splats: they can land anywhere on the film, but are few - kept as a flat list of
 *   `[pixel index, r, g, b, ...]` instead of a whole-film buffer per band
 */
export class BandBuffer implements SampleSink {
  readonly sums: Float32Array
  private readonly splats: number[] = []
  raysCast = 0

  constructor(
    readonly width: number,
    readonly job: BandJob,
  ) {
    this.sums = new Float32Array(width * job.rowCount * 3)
  }

  addSample(x: number, y: number, radiance: Color): void {
    const index = ((y - this.job.firstRow) * this.width + x) * 3
    this.sums[index] += radiance.r
    this.sums[index + 1] += radiance.g
    this.sums[index + 2] += radiance.b
  }

  addSplat(filmX: number, filmY: number, radiance: Color): void {
    const pixel = Math.floor(filmY) * this.width + Math.floor(filmX)
    this.splats.push(pixel, radiance.r, radiance.g, radiance.b)
  }

  splatList(): Float32Array {
    return new Float32Array(this.splats)
  }
}

export function renderBand(
  scene: Scene,
  integrator: Integrator,
  width: number,
  job: BandJob,
): BandBuffer {
  const buffer = new BandBuffer(width, job)
  const raysBefore = scene.raysCast
  for (let y = job.firstRow; y < job.firstRow + job.rowCount; y++) {
    const random = new Sfc32(rowSeed(job.pass, y))
    for (let x = 0; x < width; x++) {
      integrator.renderSample(x, y, buffer, random)
    }
  }
  buffer.raysCast = scene.raysCast - raysBefore
  return buffer
}

/**
 * every (pass, row) gets its own random stream - so the image doesn't depend on which worker
 * rendered which band, and any band can be re-rendered exactly (tests, debugging)
 */
function rowSeed(pass: number, row: number): number {
  return Math.imul(pass, 0x9e3779b1) ^ row
}
