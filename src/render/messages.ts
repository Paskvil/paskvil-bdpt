import type { BandJob } from './band'
import type { RenderSettings } from './settings'

/** PSSMLT's unit of work: advance one Markov chain by a number of mutations */
export interface ChainJob {
  chain: number
  mutations: number
}

/**
 * main thread ↔ worker protocol
 *
 * `generation` increases on every settings change; anything tagged with an older generation is
 * stale and gets dropped - so a reset never has to wait for in-flight work
 */
export type ToWorker =
  | { type: 'configure'; generation: number; settings: RenderSettings }
  | { type: 'render-band'; generation: number; job: BandJob }
  | { type: 'run-chain'; generation: number; job: ChainJob }

export type FromWorker =
  | {
      type: 'band'
      generation: number
      job: BandJob
      sums: Float32Array
      splats: Float32Array
      raysCast: number
    }
  | { type: 'chain'; generation: number; job: ChainJob; splats: Float32Array; raysCast: number }
