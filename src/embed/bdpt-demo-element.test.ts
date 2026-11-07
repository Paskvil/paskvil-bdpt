// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { RENDER_SIZE } from './bdpt-demo-element'
import '../index'

describe('<bdpt-demo>', () => {
  it('renders a fixed-size canvas in its shadow root', () => {
    const element = document.createElement('bdpt-demo')
    const canvas = element.shadowRoot?.querySelector('canvas')

    expect(canvas?.width).toBe(RENDER_SIZE)
    expect(canvas?.height).toBe(RENDER_SIZE)
  })
})
