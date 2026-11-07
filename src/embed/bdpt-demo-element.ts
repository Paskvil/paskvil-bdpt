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
    drawPlaceholder(this.canvas)
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

function drawPlaceholder(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#666'
  ctx.font = '16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('nothing rendered yet', canvas.width / 2, canvas.height / 2)
}
