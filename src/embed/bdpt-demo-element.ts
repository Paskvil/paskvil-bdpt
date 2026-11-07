import { PathTracer } from '../integrators/path-tracer'
import { ProgressiveRenderer } from '../render/progressive-renderer'
import { createCornellBox } from '../scene/cornell-box'
import styles from './bdpt-demo.css?inline'

/** fixed render resolution - the canvas is CSS-scaled to fit the element */
export const RENDER_SIZE = 512

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
  private renderer: ProgressiveRenderer | null = null

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
    const scene = createCornellBox({
      lights: { top: true, left: true, right: true },
      width: RENDER_SIZE,
      height: RENDER_SIZE,
    })
    this.renderer = new ProgressiveRenderer(this.canvas, new PathTracer(scene, { maxDepth: 10 }))
    this.renderer.start()
  }

  disconnectedCallback(): void {
    this.renderer?.stop()
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
