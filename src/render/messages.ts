import type { BandJob } from './band'
import type { RenderSettings } from './settings'

/**
 * main thread ↔ worker protocol
 *
 * `generation` increases on every settings change; anything tagged with an older generation is
 * stale and gets dropped - so a reset never has to wait for in-flight work
 */
export type ToWorker =
  | { type: 'configure'; generation: number; settings: RenderSettings }
  | { type: 'render'; generation: number; job: BandJob }

export interface FromWorker {
  type: 'band'
  generation: number
  job: BandJob
  sums: Float32Array
  splats: Float32Array
}
