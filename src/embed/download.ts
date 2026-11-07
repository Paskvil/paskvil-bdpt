/** saves the canvas as a PNG through a temporary download link */
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
