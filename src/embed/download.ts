/** colours and font for the stats strip - the element's theme */
export interface StripStyle {
  background: string
  text: string
  textDim: string
  font: string
}

const STRIP_FONT_SIZE = 12
const STRIP_LINE_HEIGHT = 18
const STRIP_PADDING = 10

/**
 * a copy of the render with a strip of text lines underneath - the render itself stays untouched,
 * so a series of snapshots lines up (timelapse)
 */
export function withStrip(
  render: HTMLCanvasElement,
  lines: string[],
  style: StripStyle,
): HTMLCanvasElement {
  const stripHeight = 2 * STRIP_PADDING + lines.length * STRIP_LINE_HEIGHT
  const canvas = document.createElement('canvas')
  canvas.width = render.width
  canvas.height = render.height + stripHeight
  const context = canvas.getContext('2d')
  if (!context) return render

  context.drawImage(render, 0, 0)
  context.fillStyle = style.background
  context.fillRect(0, render.height, canvas.width, stripHeight)

  context.font = `${STRIP_FONT_SIZE}px ${style.font}`
  context.textBaseline = 'top'
  lines.forEach((line, index) => {
    // the last line (the stats) stands out, the settings above it are dimmer
    context.fillStyle = index === lines.length - 1 ? style.text : style.textDim
    const y = render.height + STRIP_PADDING + index * STRIP_LINE_HEIGHT
    context.fillText(line, STRIP_PADDING, y)
  })
  return canvas
}

/** saves a canvas as a PNG through a temporary download link */
export function downloadPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

/** e.g. `bdpt-00256spp.png` - zero-padded so a series of snapshots sorts in order */
export function snapshotFilename(integrator: string, samplesPerPixel: number): string {
  const samples = String(Math.floor(samplesPerPixel)).padStart(5, '0')
  return `${integrator}-${samples}spp.png`
}
