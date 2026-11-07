import { describe, expect, it } from 'vitest'
import type { DemoControls } from './demo-controls'
import { describeSettings, formatStats } from './stats'

const CONTROLS: DemoControls = {
  lights: { top: true, left: false, right: true },
  balls: { left: 'mirror', right: 'glass' },
  integrator: 'bdpt',
  sampleLimit: null,
  pngWithStats: true,
}
const STATS = {
  samplesPerPixel: 12.25,
  sampleCount: 3_211_264,
  raysCast: 45_600_000,
  renderTimeMs: 75_500,
}

describe('formatStats', () => {
  it('formats compactly', () => {
    const values = Object.fromEntries(
      formatStats(STATS, CONTROLS).map((stat) => [stat.label, stat.value]),
    )
    expect(values).toEqual({ SPP: '12.3', RAYS: '45.6M', 'R/S': '604k', TIME: '1:15', LP: '3.21M' })
  })

  it('has no light paths for the path tracer', () => {
    const labels = formatStats(STATS, { ...CONTROLS, integrator: 'path-tracer' }).map(
      (stat) => stat.label,
    )
    expect(labels).not.toContain('LP')
  })
})

describe('describeSettings', () => {
  it('lists the integrator, the lights that are on and the materials', () => {
    expect(describeSettings(CONTROLS)).toEqual([
      'bdpt · lights top + right',
      'left ball mirror · right ball glass',
    ])
  })
})
