import { Film } from '../film/film'
import { writeToImageData } from '../film/tone-map'
import type { FromWorker, ToWorker } from './messages'
import RenderWorker from './render-worker?worker&inline'
import type { RenderSettings } from './settings'
import { BandPlan, ChainPlan, type WorkPlan } from './work-plans'

/** jobs queued per worker, so it never sits idle waiting for the next one to arrive */
const JOBS_PER_WORKER = 2

const MAX_FRAME_GAP_MS = 250

/** progress of the current render - all reset by `configure` */
export interface RenderStats {
  samplesPerPixel: number
  /** samples over all pixels = light paths traced (BDPT and PSSMLT trace one per sample) */
  sampleCount: number
  raysCast: number
  /** time spent rendering, not counting pauses */
  renderTimeMs: number
}

/**
 * progressive rendering on a pool of workers
 *
 * - the main thread hands out jobs - bands of rows, or PSSMLT chain steps (see work-plans.ts) -
 *   and adds the results to the film; the canvas is redrawn at most once per animation frame
 * - `configure` restarts from an empty film; results of earlier settings are dropped (see messages.ts)
 * - with a sample limit, no jobs are handed out beyond that many samples per pixel
 */
export class ParallelRenderer {
  private readonly context: CanvasRenderingContext2D
  private readonly workers: { worker: Worker; jobsInFlight: number }[]
  private film: Film | null = null
  private image: ImageData | null = null
  private generation = 0
  private plan: WorkPlan | null = null
  private running = false
  private sampleLimit: number | null = null
  private imageOutdated = false
  private frameRequest: number | null = null
  private raysCast = 0
  private renderTimeMs = 0
  private lastFrameTime: number | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    workerCount = defaultWorkerCount(),
  ) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas 2D context not available')
    this.context = context

    this.workers = Array.from({ length: workerCount }, () => {
      const entry = { worker: new RenderWorker(), jobsInFlight: 0 }
      entry.worker.onmessage = (event: MessageEvent<FromWorker>) => this.onResult(entry, event.data)
      return entry
    })
  }

  get samplesPerPixel(): number {
    return this.film?.samplesPerPixel() ?? 0
  }

  stats(): RenderStats {
    return {
      samplesPerPixel: this.samplesPerPixel,
      sampleCount: this.film?.sampleCount ?? 0,
      raysCast: this.raysCast,
      renderTimeMs: this.renderTimeMs,
    }
  }

  /** stop after this many samples per pixel - `null` renders on indefinitely */
  setSampleLimit(limit: number | null): void {
    this.sampleLimit = limit
    this.dispatchJobs()
  }

  /** (re)starts the render from scratch with new settings */
  configure(settings: RenderSettings): void {
    this.generation++
    this.film = new Film(settings.width, settings.height)
    this.image = this.context.createImageData(settings.width, settings.height)
    // only on change - assigning the size clears the canvas, even to the same value
    if (this.canvas.width !== settings.width) this.canvas.width = settings.width
    if (this.canvas.height !== settings.height) this.canvas.height = settings.height
    this.plan =
      settings.integrator.kind === 'pssmlt'
        ? new ChainPlan(this.workers.length, settings.width * settings.height)
        : new BandPlan(settings.height)
    this.raysCast = 0
    this.renderTimeMs = 0

    for (const entry of this.workers) {
      entry.jobsInFlight = 0 // the workers skip jobs of older generations without replying
      this.post(entry.worker, { type: 'configure', generation: this.generation, settings })
    }
    this.dispatchJobs()
  }

  start(): void {
    this.running = true
    this.dispatchJobs()
    this.frameRequest ??= requestAnimationFrame(this.drawFrame)
  }

  /** pauses - jobs already handed out still finish and show up */
  stop(): void {
    this.running = false
  }

  dispose(): void {
    this.stop()
    if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest)
    this.frameRequest = null
    for (const { worker } of this.workers) worker.terminate()
  }

  private onResult(entry: { jobsInFlight: number }, message: FromWorker): void {
    if (message.generation !== this.generation || !this.film) return
    entry.jobsInFlight--
    if (message.type === 'band') {
      this.film.addBand(message.job.firstRow, message.job.rowCount, message.sums)
    } else {
      this.film.addSplatOnlySamples(message.job.mutations)
    }
    this.film.addSplatList(message.splats)
    this.raysCast += message.raysCast
    this.imageOutdated = true
    this.dispatchJobs()
  }

  /** tops every worker up to `JOBS_PER_WORKER` jobs */
  private dispatchJobs(): void {
    if (!this.running || !this.plan) return
    this.workers.forEach((entry, index) => {
      while (entry.jobsInFlight < JOBS_PER_WORKER) {
        const job = this.plan?.next(index, this.sampleLimit)
        if (!job) return
        this.post(entry.worker, { ...job, generation: this.generation })
        entry.jobsInFlight++
      }
    })
  }

  private isBusy(): boolean {
    return this.workers.some((entry) => entry.jobsInFlight > 0)
  }

  private post(worker: Worker, message: ToWorker): void {
    worker.postMessage(message)
  }

  private readonly drawFrame = (now: number): void => {
    // the clock runs while any worker has work - i.e. not when paused or done; a frame gap is
    // capped, as frames stop in a hidden tab while the last jobs may still be finishing
    if (this.lastFrameTime !== null && this.isBusy()) {
      this.renderTimeMs += Math.min(now - this.lastFrameTime, MAX_FRAME_GAP_MS)
    }
    this.lastFrameTime = now

    if (this.imageOutdated && this.film && this.image) {
      writeToImageData(this.film, this.image)
      this.context.putImageData(this.image, 0, 0)
      this.imageOutdated = false
    }
    this.frameRequest = requestAnimationFrame(this.drawFrame)
  }
}

/** all cores but one - that one stays with the page (UI, other scripts) */
function defaultWorkerCount(): number {
  return Math.max(1, (navigator.hardwareConcurrency || 2) - 1)
}
