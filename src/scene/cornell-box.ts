import { Color } from '../math/color'
import { Vec3, vec3 } from '../math/vec3'
import { AreaLight } from './area-light'
import { Camera } from './camera'
import { Diffuse } from './materials/diffuse'
import { Scene, type SceneObject } from './scene'
import { Quad } from './shapes/quad'
import { Sphere } from './shapes/sphere'

/**
 * the demo scene - modified Cornell box, see PLAN.md "scene" for the layout and the reasoning
 *
 * unit box, y up: x from the red wall (0) to the green one (1), y from floor (0) to ceiling (1),
 * z from the back wall (0) to the open front (1); the camera looks down -z
 */

export interface LightSwitches {
  top: boolean
  left: boolean
  right: boolean
}

export interface CornellBoxOptions {
  lights: LightSwitches
  width: number
  height: number
}

const WHITE = new Diffuse(Color.gray(0.73))
const RED = new Diffuse(new Color(0.65, 0.05, 0.05))
const GREEN = new Diffuse(new Color(0.12, 0.45, 0.15))
const LIGHT_BLUE = new Diffuse(new Color(0.45, 0.6, 0.85))
const LIGHT_PEACH = new Diffuse(new Color(0.9, 0.62, 0.48))
/** light panels only emit - they don't reflect anything */
const LIGHT_SURFACE = new Diffuse(Color.BLACK)

/** same radiance on every panel - smaller panels give off less light */
const LIGHT_RADIANCE = Color.gray(10)
const TOP_LIGHT_SIZE = 0.25
const SIDE_LIGHT_SIZE = 0.125
/** light panels sit this far off their wall, so the two aren't coplanar */
const LIGHT_OFFSET = 1e-3

const BALL_RADIUS = 1 / 6

const CAMERA_FOV_DEGREES = 40
/** at 40° the open front (1 unit tall) exactly fills the frame from z ≈ 2.374 - slightly closer crops the edges */
const CAMERA_DISTANCE = 2.37

export function createCornellBox(options: CornellBoxOptions): Scene {
  const objects = [...walls(), ...balls(), ...lights(options.lights)]
  const camera = new Camera(
    vec3(0.5, 0.5, CAMERA_DISTANCE),
    vec3(0.5, 0.5, 0),
    CAMERA_FOV_DEGREES,
    options.width,
    options.height,
  )
  return new Scene(objects, camera)
}

/** edge order sets the facing (`normal = edgeU × edgeV`) - every wall faces into the box */
function walls(): SceneObject[] {
  const x = vec3(1, 0, 0)
  const y = vec3(0, 1, 0)
  const z = vec3(0, 0, 1)
  return [
    { name: 'floor', shape: new Quad(Vec3.ZERO, z, x), material: WHITE },
    { name: 'ceiling', shape: new Quad(y, x, z), material: WHITE },
    { name: 'back wall', shape: new Quad(Vec3.ZERO, x, y), material: WHITE },
    { name: 'left wall', shape: new Quad(Vec3.ZERO, y, z), material: RED },
    { name: 'right wall', shape: new Quad(x, z, y), material: GREEN },
  ]
}

function balls(): SceneObject[] {
  return [
    {
      name: 'left ball',
      shape: new Sphere(vec3(0.3, BALL_RADIUS, 0.35), BALL_RADIUS),
      material: LIGHT_BLUE,
    },
    {
      name: 'right ball',
      shape: new Sphere(vec3(0.68, 0.45, 0.65), BALL_RADIUS),
      material: LIGHT_PEACH,
    },
  ]
}

function lights(switches: LightSwitches): SceneObject[] {
  const top = TOP_LIGHT_SIZE
  const side = SIDE_LIGHT_SIZE
  const panels: { name: string; on: boolean; quad: Quad }[] = [
    {
      name: 'top light',
      on: switches.top,
      quad: Quad.centered(vec3(0.5, 1 - LIGHT_OFFSET, 0.5), vec3(top, 0, 0), vec3(0, 0, top)),
    },
    ...[0.25, 0.75].map((height) => ({
      name: `left light at y=${height}`,
      on: switches.left,
      quad: Quad.centered(vec3(LIGHT_OFFSET, height, 0.5), vec3(0, side, 0), vec3(0, 0, side)),
    })),
    ...[0.25, 0.75].map((depth) => ({
      name: `right light at z=${depth}`,
      on: switches.right,
      quad: Quad.centered(vec3(1 - LIGHT_OFFSET, 0.5, depth), vec3(0, 0, side), vec3(0, side, 0)),
    })),
  ]

  return panels
    .filter((panel) => panel.on)
    .map((panel) => ({
      name: panel.name,
      shape: panel.quad,
      material: LIGHT_SURFACE,
      light: new AreaLight(panel.quad, LIGHT_RADIANCE),
    }))
}
