import type { BandJob } from './band'
import type { ChainJob } from './messages'

/** a job for a worker, as the message type it travels in */
export type Job = { type: 'render-band'; job: BandJob } | { type: 'run-chain'; job: ChainJob }

/** hands out the work of one render, job by job */
export interface WorkPlan {
  /**
   * the next job for the worker with this index - `null` once `sampleLimit` samples per pixel
   * have been handed out
   */
  next(worker: number, sampleLimit: number | null): Job | null
}

/** rows per band - small enough to keep the image updating smoothly, big enough to keep messaging cheap */
const BAND_ROWS = 8

/**
 * path tracing and BDPT: bands of rows, pass after pass, top to bottom - any worker can take any
 * band, since every row of every pass has its own random seed
 */
export class BandPlan implements WorkPlan {
  private nextJob: BandJob = { pass: 0, firstRow: 0, rowCount: BAND_ROWS }

  constructor(private readonly height: number) {}

  next(_worker: number, sampleLimit: number | null): Job | null {
    if (sampleLimit !== null && this.nextJob.pass >= sampleLimit) return null
    const job = this.nextJob
    const nextRow = job.firstRow + job.rowCount
    this.nextJob =
      nextRow >= this.height
        ? { pass: job.pass + 1, firstRow: 0, rowCount: BAND_ROWS }
        : {
            pass: job.pass,
            firstRow: nextRow,
            rowCount: Math.min(BAND_ROWS, this.height - nextRow),
          }
    return { type: 'render-band', job }
  }
}

/** Markov chains of one render - more chains, less correlated noise early on */
const CHAINS = 128
/** mutations per job - about the work of one band of BDPT */
const MUTATIONS_PER_JOB = 4096

/**
 * PSSMLT: chains advanced a batch of mutations at a time. a chain's state lives in the worker
 * running it, so chain `k` always goes to worker `k mod workers`, which takes its chains in turn
 */
export class ChainPlan implements WorkPlan {
  private mutationsHandedOut = 0
  /** per worker: how many jobs it has had so far - picks its next chain */
  private readonly jobsPerWorker: number[]

  constructor(
    private readonly workerCount: number,
    private readonly pixelCount: number,
  ) {
    this.jobsPerWorker = new Array<number>(workerCount).fill(0)
  }

  next(worker: number, sampleLimit: number | null): Job | null {
    const limit = sampleLimit === null ? Infinity : sampleLimit * this.pixelCount
    const mutations = Math.min(MUTATIONS_PER_JOB, limit - this.mutationsHandedOut)
    if (mutations <= 0) return null

    const chainsOfWorker = Math.ceil((CHAINS - worker) / this.workerCount)
    const turn = this.jobsPerWorker[worker]++ % chainsOfWorker
    const chain = worker + turn * this.workerCount
    this.mutationsHandedOut += mutations
    return { type: 'run-chain', job: { chain, mutations } }
  }
}
