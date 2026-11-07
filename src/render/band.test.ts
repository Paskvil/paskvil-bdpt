import { describe, expect, it } from 'vitest'
import { renderBand } from './band'
import { createRenderSetup, type RenderSettings, type RenderSetup } from './settings'
import type { BandJob } from './band'

const SETTINGS: RenderSettings = {
  width: 16,
  height: 16,
  lights: { top: true, left: true, right: true },
  balls: { left: 'diffuse', right: 'diffuse' },
  integrator: { kind: 'path-tracer', maxDepth: 5 },
}

function renderWith(setup: RenderSetup, job: BandJob) {
  return renderBand(setup.scene, setup.integrator, SETTINGS.width, job)
}

describe('renderBand', () => {
  it('is reproducible - same job, same pixels, even on a separately built scene', () => {
    const job = { pass: 3, firstRow: 4, rowCount: 2 }
    const first = renderWith(createRenderSetup(SETTINGS), job)
    const second = renderWith(createRenderSetup(SETTINGS), job)
    expect(second.sums).toEqual(first.sums)
  })

  it('a row comes out the same whichever band it is rendered in', () => {
    const setup = createRenderSetup(SETTINGS)
    const wide = renderWith(setup, { pass: 0, firstRow: 0, rowCount: 8 })
    const single = renderWith(setup, { pass: 0, firstRow: 5, rowCount: 1 })
    const rowLength = SETTINGS.width * 3
    expect(single.sums).toEqual(wide.sums.slice(5 * rowLength, 6 * rowLength))
  })

  it('counts the rays it cast', () => {
    const band = renderWith(createRenderSetup(SETTINGS), { pass: 0, firstRow: 0, rowCount: 2 })
    // at least one camera ray per pixel
    expect(band.raysCast).toBeGreaterThanOrEqual(2 * SETTINGS.width)
  })

  it('different passes give different samples', () => {
    const setup = createRenderSetup(SETTINGS)
    const first = renderWith(setup, { pass: 0, firstRow: 0, rowCount: 4 })
    const second = renderWith(setup, { pass: 1, firstRow: 0, rowCount: 4 })
    expect(second.sums).not.toEqual(first.sums)
  })
})
