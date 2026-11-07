import { ParallelRenderer } from '../render/parallel-renderer'
import type { RenderSettings } from '../render/settings'
import styles from './bdpt-demo.css?inline'
import { readControls, toRenderSettings, type DemoControls } from './demo-controls'
import { downloadPng, snapshotFilename, withStrip, type StripStyle } from './download'
import { describeSettings, formatStats, showStats } from './stats'
import { TEMPLATE } from './template'

/** how often the stats overlay refreshes */
const STATS_INTERVAL_MS = 250

/**
 * `<bdpt-demo>` - the embeddable demo: render on the left, controls on the right
 *
 * rendering runs only while it's worth it: not paused by the user, on screen, and in a visible tab
 */
export class BdptDemoElement extends HTMLElement {
  readonly canvas: HTMLCanvasElement
  readonly form: HTMLFormElement
  private readonly pauseButton: HTMLButtonElement
  private readonly statsList: HTMLElement
  private renderer: ParallelRenderer | null = null
  private controls: DemoControls
  private renderedSettings: RenderSettings | null = null
  private pausedByUser = false
  private onScreen = true
  private visibilityObserver: IntersectionObserver | null = null
  private statsTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(styles)
    shadow.adoptedStyleSheets = [sheet]
    shadow.innerHTML = TEMPLATE

    this.canvas = requireElement<HTMLCanvasElement>(shadow, 'canvas')
    this.form = requireElement<HTMLFormElement>(shadow, 'form')
    this.pauseButton = requireElement<HTMLButtonElement>(shadow, 'button[name="pause"]')
    this.statsList = requireElement<HTMLElement>(shadow, '.stats')
    const downloadButton = requireElement<HTMLButtonElement>(shadow, 'button[name="download"]')

    this.controls = readControls(this.form)
    this.form.addEventListener('change', this.onControlsChange)
    this.pauseButton.addEventListener('click', this.onPauseClick)
    downloadButton.addEventListener('click', this.onDownloadClick)
  }

  connectedCallback(): void {
    this.renderer = new ParallelRenderer(this.canvas)
    this.renderedSettings = null
    this.applyControls()
    this.visibilityObserver = new IntersectionObserver((entries) => {
      this.onScreen = entries.some((entry) => entry.isIntersecting)
      this.updateRunning()
    })
    this.visibilityObserver.observe(this)
    document.addEventListener('visibilitychange', this.updateRunning)
    this.statsTimer = setInterval(this.updateStats, STATS_INTERVAL_MS)
  }

  disconnectedCallback(): void {
    this.visibilityObserver?.disconnect()
    document.removeEventListener('visibilitychange', this.updateRunning)
    if (this.statsTimer !== null) clearInterval(this.statsTimer)
    this.renderer?.dispose()
    this.renderer = null
  }

  private readonly onControlsChange = (event: Event): void => {
    keepOneLightOn(this.form, event.target)
    this.controls = readControls(this.form)
    this.applyControls()
  }

  /** restarts the render only when the image itself changes - not e.g. for a new sample limit */
  private applyControls(): void {
    if (!this.renderer) return
    const settings = toRenderSettings(this.controls)
    if (JSON.stringify(settings) !== JSON.stringify(this.renderedSettings)) {
      this.renderer.configure(settings)
      this.renderedSettings = settings
    }
    this.renderer.setSampleLimit(this.controls.sampleLimit)
    this.updateRunning()
  }

  private readonly onPauseClick = (): void => {
    this.pausedByUser = !this.pausedByUser
    this.pauseButton.textContent = this.pausedByUser ? 'resume' : 'pause'
    this.pauseButton.setAttribute('aria-pressed', String(this.pausedByUser))
    this.updateRunning()
  }

  private readonly onDownloadClick = (): void => {
    if (!this.renderer) return
    const stats = this.renderer.stats()
    const filename = snapshotFilename(this.controls.integrator, stats.samplesPerPixel)
    if (!this.controls.pngWithStats) {
      downloadPng(this.canvas, filename)
      return
    }

    const statsLine = formatStats(stats, this.controls)
      .map((stat) => `${stat.label} ${stat.value}`)
      .join(' · ')
    const lines = [...describeSettings(this.controls), statsLine]
    downloadPng(withStrip(this.canvas, lines, this.stripStyle()), filename)
  }

  /** the strip under a downloaded PNG uses the element's theme */
  private stripStyle(): StripStyle {
    const style = getComputedStyle(this)
    const token = (name: string) => style.getPropertyValue(`--bdpt-${name}`).trim()
    return {
      background: token('background'),
      text: token('text-strong'),
      textDim: token('text-dim'),
      font: token('mono'),
    }
  }

  private readonly updateStats = (): void => {
    if (this.renderer) showStats(this.statsList, formatStats(this.renderer.stats(), this.controls))
  }

  private readonly updateRunning = (): void => {
    const shouldRun = !this.pausedByUser && this.onScreen && !document.hidden
    if (shouldRun) this.renderer?.start()
    else this.renderer?.stop()
  }
}

/** the last light that's on can't be switched off - it's switched straight back on */
function keepOneLightOn(form: HTMLFormElement, changed: EventTarget | null): void {
  const anyLightOn = form.querySelector('input[name="light"]:checked') !== null
  if (!anyLightOn && changed instanceof HTMLInputElement) changed.checked = true
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`<bdpt-demo>: missing ${selector} in template`)
  return element
}
