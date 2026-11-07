import { Film } from '../film/film'
import { writeToImageData } from '../film/tone-map'
import type { BandJob } from './band'
import type { FromWorker, ToWorker } from './messages'
import RenderWorker from './render-worker?worker&inline'
import type { RenderSettings } from './settings'

/** rows per job - small enough to keep the image updating smoothly, big enough to keep messaging cheap */
const BAND_ROWS = 8
/** jobs queued per worker, so it never sits idle waiting for the next one to arrive */
const JOBS_PER_WORKER = 2

/**
 * progressive rendering on a pool of workers
 *
 * - the main thread hands out bands of rows (pass by pass, top to bottom) and adds the results to
 *   the film; the canvas is redrawn at most once per animation frame
 * - `configure` restarts from an empty film; results of earlier settings are dropped (see messages.ts)
 * - with a sample limit, no jobs are handed out beyond that many passes
 */
export class ParallelRenderer {
  private readonly context: CanvasRenderingContext2D
  private readonly workers: { worker: Worker; jobsInFlight: number }[]
  private settings: RenderSettings | null = null
  private film: Film | null = null
  private image: ImageData | null = null
  private generation = 0
  private nextJob: BandJob = { pass: 0, firstRow: 0, rowCount: BAND_ROWS }
  private running = false
  private sampleLimit: number | null = null
  private imageOutdated = false
  private frameRequest: number | null = null

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

  /** stop after this many samples per pixel - `null` renders on indefinitely */
  setSampleLimit(limit: number | null): void {
    this.sampleLimit = limit
    this.dispatchJobs()
  }

  /** (re)starts the render from scratch with new settings */
  configure(settings: RenderSettings): void {
    this.settings = settings
    this.generation++
    this.film = new Film(settings.width, settings.height)
    this.image = this.context.createImageData(settings.width, settings.height)
    // only on change - assigning the size clears the canvas, even to the same value
    if (this.canvas.width !== settings.width) this.canvas.width = settings.width
    if (this.canvas.height !== settings.height) this.canvas.height = settings.height
    this.nextJob = { pass: 0, firstRow: 0, rowCount: BAND_ROWS }

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
    this.film.addBand(message.job.firstRow, message.job.rowCount, message.sums)
    this.film.addSplatList(message.splats)
    this.imageOutdated = true
    this.dispatchJobs()
  }

  /** tops every worker up to `JOBS_PER_WORKER` jobs */
  private dispatchJobs(): void {
    if (!this.running || !this.settings) return
    for (const entry of this.workers) {
      while (entry.jobsInFlight < JOBS_PER_WORKER && !this.reachedLimit()) {
        const job = this.takeNextJob(this.settings.height)
        this.post(entry.worker, { type: 'render', generation: this.generation, job })
        entry.jobsInFlight++
      }
    }
  }

  private reachedLimit(): boolean {
    return this.sampleLimit !== null && this.nextJob.pass >= this.sampleLimit
  }

  private takeNextJob(height: number): BandJob {
    const job = this.nextJob
    const nextRow = job.firstRow + job.rowCount
    this.nextJob =
      nextRow >= height
        ? { pass: job.pass + 1, firstRow: 0, rowCount: BAND_ROWS }
        : { pass: job.pass, firstRow: nextRow, rowCount: Math.min(BAND_ROWS, height - nextRow) }
    return job
  }

  private post(worker: Worker, message: ToWorker): void {
    worker.postMessage(message)
  }

  private readonly drawFrame = (): void => {
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
