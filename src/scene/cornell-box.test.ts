import { describe, expect, it } from 'vitest'
import { vec3 } from '../math/vec3'
import { createCornellBox } from './cornell-box'
import { Quad } from './shapes/quad'
import { Sphere } from './shapes/sphere'

const ALL_ON = { top: true, left: true, right: true }
const BOX_CENTER = vec3(0.5, 0.5, 0.5)

function scene(lights = ALL_ON) {
  return createCornellBox({
    lights,
    balls: { left: 'diffuse', right: 'diffuse' },
    width: 64,
    height: 64,
  })
}

describe('createCornellBox', () => {
  it('every wall and light panel faces into the box', () => {
    for (const { name, shape } of scene().objects) {
      if (!(shape instanceof Quad)) continue
      const toCenter = BOX_CENTER.sub(shape.corner)
      expect(shape.normal.dot(toCenter), name).toBeGreaterThan(0)
    }
  })

  it('has 5 light panels, all with the same radiance', () => {
    const { lights } = scene()
    expect(lights).toHaveLength(5)
    for (const light of lights) expect(light.radiance).toEqual(lights[0].radiance)
  })

  it('switches light groups independently', () => {
    expect(scene({ top: true, left: false, right: false }).lights).toHaveLength(1)
    expect(scene({ top: false, left: true, right: false }).lights).toHaveLength(2)
    expect(scene({ top: false, left: false, right: true }).lights).toHaveLength(2)
  })

  it('side panels have a quarter of the top light area', () => {
    const [top, ...sides] = scene().lights
    for (const side of sides) expect(side.shape.area).toBeCloseTo(top.shape.area / 4)
  })

  it('balls are inside the box, the left one rests on the floor', () => {
    const balls = scene()
      .objects.map((object) => object.shape)
      .filter((shape) => shape instanceof Sphere)
    expect(balls).toHaveLength(2)
    for (const { center, radius } of balls) {
      for (const coordinate of [center.x, center.y, center.z]) {
        expect(coordinate - radius).toBeGreaterThanOrEqual(0)
        expect(coordinate + radius).toBeLessThanOrEqual(1)
      }
    }
    expect(balls[0].center.y).toBeCloseTo(balls[0].radius)
  })
})
