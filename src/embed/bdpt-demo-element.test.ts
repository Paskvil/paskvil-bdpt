// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { BdptDemoElement } from './bdpt-demo-element'
import { readControls, RENDER_SIZE } from './demo-controls'
import { snapshotFilename } from './download'
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
    })
  })

  it('reads the controls as set', () => {
    const element = createElement()
    input(element, 'light', 'left').checked = false
    input(element, 'right-ball', 'glass').checked = true
    input(element, 'integrator', 'path-tracer').checked = true
    field<HTMLSelectElement>(element, 'select[name="sample-limit"]').value = '1024'

    expect(readControls(element.form)).toEqual({
      lights: { top: true, left: false, right: true },
      balls: { left: 'diffuse', right: 'glass' },
      integrator: 'path-tracer',
      sampleLimit: 1024,
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
