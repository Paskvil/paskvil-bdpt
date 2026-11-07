// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { BdptDemoElement } from './bdpt-demo-element'
import { DEFAULT_ADVANCED, readControls, RENDER_SIZE } from './demo-controls'
import { snapshotFilename } from './download'
import { showStats } from './stats'
import '../index'

function createElement(): BdptDemoElement {
  return document.createElement('bdpt-demo') as BdptDemoElement
}

function field<T extends Element>(element: BdptDemoElement, selector: string): T {
  const found = element.form.querySelector<T>(selector)
  if (!found) throw new Error(`no ${selector} in the form`)
  return found
}

function input(element: BdptDemoElement, name: string, value: string): HTMLInputElement {
  return field(element, `input[name="${name}"][value="${value}"]`)
}

describe('<bdpt-demo>', () => {
  it('renders a fixed-size canvas in its shadow root', () => {
    const { canvas } = createElement()
    expect(canvas.width).toBe(RENDER_SIZE)
    expect(canvas.height).toBe(RENDER_SIZE)
  })

  it('starts with all lights on, diffuse balls, BDPT, no sample limit', () => {
    expect(readControls(createElement().form)).toEqual({
      lights: { top: true, left: true, right: true },
      balls: { left: 'diffuse', right: 'diffuse' },
      integrator: 'bdpt',
      sampleLimit: null,
      pngWithStats: true,
      advanced: DEFAULT_ADVANCED,
    })
  })

  it('reads the controls as set', () => {
    const element = createElement()
    input(element, 'light', 'left').checked = false
    input(element, 'right-ball', 'glass').checked = true
    input(element, 'integrator', 'path-tracer').checked = true
    field<HTMLSelectElement>(element, 'select[name="sample-limit"]').value = '1024'
    field<HTMLInputElement>(element, 'input[name="max-depth"]').value = '4'
    input(element, 'heuristic', 'balance').checked = true
    input(element, 'strategy-view', 'one').checked = true
    field<HTMLInputElement>(element, 'input[name="s"]').value = '2'
    field<HTMLInputElement>(element, 'input[name="t"]').value = '1'
    input(element, 'weighting', 'unweighted').checked = true

    expect(readControls(element.form)).toEqual({
      lights: { top: true, left: false, right: true },
      balls: { left: 'diffuse', right: 'glass' },
      integrator: 'path-tracer',
      sampleLimit: 1024,
      pngWithStats: true,
      advanced: { maxDepth: 4, heuristic: 'balance', strategy: { s: 2, t: 1, weighted: false } },
    })
  })

  it('keeps the last light on', () => {
    const element = createElement()
    input(element, 'light', 'top').checked = false
    input(element, 'light', 'left').checked = false
    const last = input(element, 'light', 'right')
    last.checked = false
    last.dispatchEvent(new Event('change', { bubbles: true }))

    expect(last.checked).toBe(true)
  })
})

describe('snapshotFilename', () => {
  it('zero-pads the sample count so snapshots sort', () => {
    expect(snapshotFilename('bdpt', 256.7)).toBe('bdpt-00256spp.png')
  })
})

describe('showStats', () => {
  const stat = (label: string, value: string) => ({ label, value, description: `about ${label}` })

  it('shows each stat with its description on hover, updating values in place', () => {
    const list = document.createElement('dl')
    showStats(list, [stat('SPP', '1.0'), stat('RAYS', '10k')])
    const firstEntry = list.children[0]
    showStats(list, [stat('SPP', '2.0'), stat('RAYS', '20k')])

    expect(list.children[0]).toBe(firstEntry) // not rebuilt - a tooltip being shown stays
    expect(firstEntry.getAttribute('title')).toBe('about SPP')
    expect(list.textContent).toBe('SPP2.0RAYS20k')
  })
})
