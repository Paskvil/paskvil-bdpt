import { Film } from '../film/film'
import { writeToImageData } from '../film/tone-map'
import type { Integrator } from '../integrators/integrator'
import { Sfc32, type Random } from '../rng/random'

/** how long one animation frame may spend rendering before the image is shown */
const FRAME_BUDGET_MS = 25

/**
 * renders on the main thread, a slice per animation frame, and shows the image after each slice
 *
 * a pass is one sample for every pixel, row by row; passes repeat until stopped
 */
export class ProgressiveRenderer {
  private readonly film: Film
  private readonly random: Random = new Sfc32(1)
  private readonly context: CanvasRenderingContext2D
  private readonly image: ImageData
  private nextPixel = 0
  private completedPasses = 0
  private frameRequest: number | null = null

  constructor(
    canvas: HTMLCanvasElement,
    private readonly integrator: Integrator,
  ) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('canvas 2D context not available')
    this.context = context
    this.film = new Film(canvas.width, canvas.height)
    this.image = context.createImageData(canvas.width, canvas.height)
  }

  get samplesPerPixel(): number {
    return this.completedPasses
  }

  start(): void {
    if (this.frameRequest === null) this.scheduleFrame()
  }

  stop(): void {
    if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest)
    this.frameRequest = null
  }

  private scheduleFrame(): void {
    this.frameRequest = requestAnimationFrame(() => {
      this.renderFor(FRAME_BUDGET_MS)
      this.present()
      this.scheduleFrame()
    })
  }

  private renderFor(budgetMs: number): void {
    const { width, height } = this.film
    const deadline = performance.now() + budgetMs
    do {
      // one row at a time - checking the clock per pixel would cost more than it saves
      const y = Math.floor(this.nextPixel / width)
      for (let x = 0; x < width; x++) {
        this.integrator.renderSample(x, y, this.film, this.random)
      }
      this.nextPixel += width
      if (this.nextPixel >= width * height) {
        this.nextPixel = 0
        this.completedPasses++
      }
    } while (performance.now() < deadline)
  }

  private present(): void {
    writeToImageData(this.film, this.image)
    this.context.putImageData(this.image, 0, 0)
  }
}
