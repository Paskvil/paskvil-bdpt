import { describe, expect, it } from 'vitest'
import { Sfc32 } from './random'

describe('Sfc32', () => {
  it('is deterministic per seed', () => {
    const a = new Sfc32(42)
    const b = new Sfc32(42)
    const c = new Sfc32(43)
    const first = a.next()
    expect(b.next()).toBe(first)
    expect(c.next()).not.toBe(first)
  })

  it('stays in [0, 1) with mean ~1/2', () => {
    const random = new Sfc32(1)
    let sum = 0
    for (let i = 0; i < 100_000; i++) {
      const value = random.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      sum += value
    }
    expect(sum / 100_000).toBeCloseTo(0.5, 2)
  })
})
