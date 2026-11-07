import type { StrategyView } from '../integrators/bdpt/bdpt'
import type { MisHeuristic } from '../integrators/bdpt/mis'
import type { RenderSettings } from '../render/settings'
import type { BallMaterial, LightSwitches } from '../scene/cornell-box'

/** fixed render resolution - the canvas is CSS-scaled to fit the element */
export const RENDER_SIZE = 512

export type IntegratorChoice = 'pssmlt' | 'bdpt' | 'path-tracer'

/** chip label, and the full name - on hover and in the PNG strip; in the order of the chips */
export const INTEGRATOR_NAMES: Record<IntegratorChoice, { short: string; full: string }> = {
  pssmlt: { short: 'pssmlt', full: 'primary sample space Metropolis light transport' },
  bdpt: { short: 'bdpt', full: 'bidirectional path tracing' },
  'path-tracer': { short: 'pt', full: 'path tracing' },
}

/** PSSMLT runs on top of BDPT, so the BDPT options (MIS, one strategy) apply to both */
export function usesBdpt(integrator: IntegratorChoice): boolean {
  return integrator !== 'path-tracer'
}

/** everything the control panel sets - read from the form in one go, see `readControls` */
export interface DemoControls {
  lights: LightSwitches
  balls: { left: BallMaterial; right: BallMaterial }
  integrator: IntegratorChoice
  /** samples per pixel to stop at - `null` for no limit */
  sampleLimit: number | null
  /** add a strip with the settings and stats under the downloaded image */
  pngWithStats: boolean
  advanced: AdvancedControls
}

/** the "advanced" section - heuristic and strategy apply to BDPT only */
export interface AdvancedControls {
  maxDepth: number
  heuristic: MisHeuristic
  /** a single (s, t) strategy to show - `null` shows the full image */
  strategy: StrategyView | null
}

export const DEFAULT_ADVANCED: AdvancedControls = {
  maxDepth: 10,
  heuristic: 'power',
  strategy: null,
}

const BALL_MATERIALS: readonly BallMaterial[] = ['diffuse', 'mirror', 'glass']
const INTEGRATORS = Object.keys(INTEGRATOR_NAMES) as IntegratorChoice[]
const HEURISTICS: readonly MisHeuristic[] = ['power', 'balance', 'uniform']

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
    pngWithStats: data.has('png-with-stats'),
    advanced: {
      maxDepth: Number(data.get('max-depth')),
      heuristic: oneOf(data.get('heuristic'), HEURISTICS),
      strategy:
        data.get('strategy-view') === 'one'
          ? {
              s: Number(data.get('s')),
              t: Number(data.get('t')),
              weighted: data.get('weighting') === 'weighted',
            }
          : null,
    },
  }
}

/** the part of the controls that defines the image - changing it restarts the render */
export function toRenderSettings(controls: DemoControls): RenderSettings {
  const { maxDepth, heuristic, strategy } = controls.advanced
  return {
    width: RENDER_SIZE,
    height: RENDER_SIZE,
    lights: controls.lights,
    balls: controls.balls,
    integrator:
      controls.integrator === 'path-tracer'
        ? { kind: 'path-tracer', maxDepth }
        : { kind: controls.integrator, maxDepth, heuristic, only: strategy },
  }
}

function oneOf<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]): T {
  const match = allowed.find((option) => option === value)
  if (!match) throw new Error(`<bdpt-demo>: unexpected form value ${String(value)}`)
  return match
}
