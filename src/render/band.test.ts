import { describe, expect, it } from 'vitest'
import { renderBand } from './band'
import { createRenderSetup, type RenderSettings } from './settings'

const SETTINGS: RenderSettings = {
  width: 16,
  height: 16,
  lights: { top: true, left: true, right: true },
  balls: { left: 'diffuse', right: 'diffuse' },
  integrator: { kind: 'path-tracer', maxDepth: 5 },
}

describe('renderBand', () => {
  it('is reproducible - same job, same pixels, even on a separately built scene', () => {
    const job = { pass: 3, firstRow: 4, rowCount: 2 }
    const first = renderBand(createRenderSetup(SETTINGS).integrator, SETTINGS.width, job)
    const second = renderBand(createRenderSetup(SETTINGS).integrator, SETTINGS.width, job)
    expect(second.sums).toEqual(first.sums)
  })

  it('a row comes out the same whichever band it is rendered in', () => {
    const { integrator } = createRenderSetup(SETTINGS)
    const wide = renderBand(integrator, SETTINGS.width, { pass: 0, firstRow: 0, rowCount: 8 })
    const single = renderBand(integrator, SETTINGS.width, { pass: 0, firstRow: 5, rowCount: 1 })
    const rowLength = SETTINGS.width * 3
    expect(single.sums).toEqual(wide.sums.slice(5 * rowLength, 6 * rowLength))
  })

  it('different passes give different samples', () => {
    const { integrator } = createRenderSetup(SETTINGS)
    const first = renderBand(integrator, SETTINGS.width, { pass: 0, firstRow: 0, rowCount: 4 })
    const second = renderBand(integrator, SETTINGS.width, { pass: 1, firstRow: 0, rowCount: 4 })
    expect(second.sums).not.toEqual(first.sums)
  })
})
