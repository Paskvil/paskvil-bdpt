import { describe, expect, it } from 'vitest'
import { PrimarySampleSpace } from './primary-sample-space'

const OPTIONS = { largeStepProbability: 0.3, smallStepSize: 0.01 }

function firstNumbers(space: PrimarySampleSpace, count: number): number[] {
  return Array.from({ length: count }, () => space.next())
}

describe('PrimarySampleSpace', () => {
  it('is reproducible per seed - a chain can restart from a bootstrap sample', () => {
    const a = firstNumbers(new PrimarySampleSpace(7, OPTIONS), 5)
    const b = firstNumbers(new PrimarySampleSpace(7, OPTIONS), 5)
    expect(b).toEqual(a)
  })

  it('stays in [0, 1)', () => {
    const space = new PrimarySampleSpace(1, OPTIONS)
    for (let iteration = 0; iteration < 2000; iteration++) {
      space.startIteration()
      for (const value of firstNumbers(space, 8)) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
      }
      space.accept()
    }
  })

  it('small steps move the numbers a little, wrapping around', () => {
    const space = new PrimarySampleSpace(3, { largeStepProbability: 0, smallStepSize: 0.01 })
    const before = firstNumbers(space, 4)
    space.startIteration()
    const after = firstNumbers(space, 4)
    after.forEach((value, index) => {
      const distance = Math.abs(value - before[index])
      expect(Math.min(distance, 1 - distance)).toBeLessThan(0.1)
    })
    expect(after).not.toEqual(before)
  })

  it('reject() restores the previous vector, accept() keeps the new one', () => {
    const space = new PrimarySampleSpace(5, OPTIONS)
    firstNumbers(space, 6)
    const original = space.snapshot()

    space.startIteration()
    firstNumbers(space, 6)
    const proposed = space.snapshot()
    expect(proposed).not.toEqual(original)
    space.reject()
    expect(space.snapshot()).toEqual(original)

    space.startIteration()
    firstNumbers(space, 6)
    const accepted = space.snapshot()
    space.accept()
    expect(space.snapshot()).toEqual(accepted)
  })

  it('a number used for the first time is uniform, also after many small steps', () => {
    // regression: new numbers used to start at 0 and get small steps from there - close to 0 or 1
    const space = new PrimarySampleSpace(9, { largeStepProbability: 0, smallStepSize: 0.01 })
    space.next()
    const fresh: number[] = []
    for (let iteration = 0; iteration < 4000; iteration++) {
      space.startIteration()
      for (let index = 0; index <= iteration; index++) {
        const value = space.next()
        if (index === iteration) fresh.push(value) // a number used for the first time
      }
      space.accept()
      if (iteration > 40) break
    }
    const middle = fresh.filter((value) => value > 0.1 && value < 0.9).length
    expect(middle / fresh.length).toBeGreaterThan(0.5)
  })
})
