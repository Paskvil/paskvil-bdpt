import { describe, expect, it } from 'vitest'
import { Color } from '../math/color'
import { Film } from './film'
import { toSrgb8 } from './tone-map'

describe('Film', () => {
  it('averages samples per pixel', () => {
    const film = new Film(2, 2)
    film.addSample(1, 0, new Color(1, 2, 3))
    film.addSample(1, 0, new Color(3, 2, 1))
    expect(film.average(1, 0)).toEqual(new Color(2, 2, 2))
    expect(film.average(0, 1)).toEqual(Color.BLACK)
  })

  it('adds a band as one sample for each of its pixels', () => {
    const film = new Film(2, 3)
    const band = new Float32Array([1, 1, 1, 2, 2, 2]) // row 1: two pixels
    film.addBand(1, 1, band)
    film.addBand(1, 1, band)
    expect(film.average(1, 1)).toEqual(new Color(2, 2, 2))
    expect(film.average(0, 0)).toEqual(Color.BLACK)
    expect(film.samplesPerPixel()).toBeCloseTo(4 / 6)
  })
})

describe('toSrgb8', () => {
  it('clamps and encodes', () => {
    expect(toSrgb8(-1)).toBe(0)
    expect(toSrgb8(0)).toBe(0)
    expect(toSrgb8(0.2158)).toBe(128) // linear 0.2158 ≈ sRGB mid-gray
    expect(toSrgb8(1)).toBe(255)
    expect(toSrgb8(5)).toBe(255)
  })
})
