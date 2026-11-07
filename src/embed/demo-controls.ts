import type { RenderSettings } from '../render/settings'
import type { BallMaterial, LightSwitches } from '../scene/cornell-box'

/** fixed render resolution - the canvas is CSS-scaled to fit the element */
export const RENDER_SIZE = 512

export type IntegratorChoice = 'bdpt' | 'path-tracer'

/** everything the control panel sets - read from the form in one go, see `readControls` */
export interface DemoControls {
  lights: LightSwitches
  balls: { left: BallMaterial; right: BallMaterial }
  integrator: IntegratorChoice
  /** samples per pixel to stop at - `null` for no limit */
  sampleLimit: number | null
}

const BALL_MATERIALS: readonly BallMaterial[] = ['diffuse', 'mirror', 'glass']
const INTEGRATORS: readonly IntegratorChoice[] = ['bdpt', 'path-tracer']

/** the form's current state - field names are the ones in template.ts */
export function readControls(form: HTMLFormElement): DemoControls {
  const data = new FormData(form)
  const lightsOn = data.getAll('light')
  const limit = Number(data.get('sample-limit'))
  return {
    lights: {
      top: lightsOn.includes('top'),
      left: lightsOn.includes('left'),
      right: lightsOn.includes('right'),
    },
    balls: {
      left: oneOf(data.get('left-ball'), BALL_MATERIALS),
      right: oneOf(data.get('right-ball'), BALL_MATERIALS),
    },
    integrator: oneOf(data.get('integrator'), INTEGRATORS),
    sampleLimit: limit > 0 ? limit : null,
  }
}

/** the part of the controls that defines the image - changing it restarts the render */
export function toRenderSettings(controls: DemoControls): RenderSettings {
  const maxDepth = 10
  return {
    width: RENDER_SIZE,
    height: RENDER_SIZE,
    lights: controls.lights,
    balls: controls.balls,
    integrator:
      controls.integrator === 'bdpt'
        ? { kind: 'bdpt', maxDepth, heuristic: 'power' }
        : { kind: 'path-tracer', maxDepth },
  }
}

function oneOf<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]): T {
  const match = allowed.find((option) => option === value)
  if (!match) throw new Error(`<bdpt-demo>: unexpected form value ${String(value)}`)
  return match
}
