import type { SampleSink } from '../film/sample-sink'
import { SplatList } from '../film/splat-list'
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
 * the result of one band, ready to transfer - the camera samples as plain RGB triples, row by row,
 * and the splats (which can land anywhere on the film) as a `SplatList`
 */
export class BandBuffer implements SampleSink {
  readonly sums: Float32Array
  private readonly splats: SplatList
  raysCast = 0

  constructor(
    readonly width: number,
    readonly job: BandJob,
  ) {
    this.sums = new Float32Array(width * job.rowCount * 3)
    this.splats = new SplatList(width)
  }

  addSample(x: number, y: number, radiance: Color): void {
    const index = ((y - this.job.firstRow) * this.width + x) * 3
    this.sums[index] += radiance.r
    this.sums[index + 1] += radiance.g
    this.sums[index + 2] += radiance.b
  }

  addSplat(filmX: number, filmY: number, radiance: Color): void {
    this.splats.addSplat(filmX, filmY, radiance)
  }

  splatList(): Float32Array {
    return this.splats.toFloat32Array()
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
