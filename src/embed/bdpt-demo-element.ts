import { ParallelRenderer } from '../render/parallel-renderer'
import type { RenderSettings } from '../render/settings'
import styles from './bdpt-demo.css?inline'

/** fixed render resolution - the canvas is CSS-scaled to fit the element */
export const RENDER_SIZE = 512

const DEFAULT_SETTINGS: RenderSettings = {
  width: RENDER_SIZE,
  height: RENDER_SIZE,
  lights: { top: true, left: true, right: true },
  balls: { left: 'diffuse', right: 'diffuse' },
  integrator: { kind: 'bdpt', maxDepth: 10, heuristic: 'power' },
}

const TEMPLATE = `
  <div class="layout">
    <div class="viewport">
      <canvas width="${RENDER_SIZE}" height="${RENDER_SIZE}"></canvas>
    </div>
    <div class="controls">controls - not yet</div>
  </div>
`

/** `<bdpt-demo>` - the embeddable demo: render on the left, controls on the right */
export class BdptDemoElement extends HTMLElement {
  readonly canvas: HTMLCanvasElement
  private renderer: ParallelRenderer | null = null

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: 'open' })
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(styles)
    shadow.adoptedStyleSheets = [sheet]
    shadow.innerHTML = TEMPLATE
    this.canvas = requireElement(shadow, 'canvas')
  }

  connectedCallback(): void {
    this.renderer = new ParallelRenderer(this.canvas)
    this.renderer.configure(DEFAULT_SETTINGS)
    this.renderer.start()
  }

  disconnectedCallback(): void {
    this.renderer?.dispose()
    this.renderer = null
  }
}

function requireElement<K extends keyof HTMLElementTagNameMap>(
  root: ParentNode,
  selector: K,
): HTMLElementTagNameMap[K] {
  const element = root.querySelector(selector)
  if (!element) throw new Error(`<bdpt-demo>: missing <${selector}> in template`)
  return element
}
