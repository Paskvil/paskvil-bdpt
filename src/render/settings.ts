import { Bdpt, type StrategyView } from '../integrators/bdpt/bdpt'
import type { MisHeuristic } from '../integrators/bdpt/mis'
import type { Integrator } from '../integrators/integrator'
import { PathTracer } from '../integrators/path-tracer'
import { Pssmlt, type PssmltOptions } from '../integrators/pssmlt/pssmlt'
import { createCornellBox, type BallMaterials, type LightSwitches } from '../scene/cornell-box'
import type { Scene } from '../scene/scene'

/**
 * everything a render depends on, as plain data - it's what gets sent to the workers, each of
 * which builds its own scene and integrator from it (class instances can't be posted)
 */
export interface RenderSettings {
  width: number
  height: number
  lights: LightSwitches
  topShade: boolean
  balls: BallMaterials
  integrator: IntegratorSettings
}

export type IntegratorSettings =
  | { kind: 'path-tracer'; maxDepth: number }
  | {
      kind: 'bdpt' | 'pssmlt'
      maxDepth: number
      heuristic: MisHeuristic
      only: StrategyView | null
    }

/** PBRT's defaults; the bootstrap takes well under a second per worker */
const PSSMLT_OPTIONS: PssmltOptions = {
  largeStepProbability: 0.3,
  smallStepSize: 0.01,
  bootstrapSamples: 50_000,
  seed: 1,
}

/**
 * - `integrator` renders pixel samples, in bands of rows
 * - `mlt` is set for PSSMLT instead - it runs Markov chains on top of `integrator` (BDPT), and its
 *   samples land anywhere on the film
 */
export interface RenderSetup {
  scene: Scene
  integrator: Integrator
  mlt: Pssmlt | null
}

export function createRenderSetup(settings: RenderSettings): RenderSetup {
  const scene = createCornellBox(settings)
  const options = settings.integrator
  if (options.kind === 'path-tracer') {
    return { scene, integrator: new PathTracer(scene, options), mlt: null }
  }

  const bdpt = new Bdpt(scene, options)
  const mlt =
    options.kind === 'pssmlt'
      ? new Pssmlt(bdpt, settings.width, settings.height, PSSMLT_OPTIONS)
      : null
  return { scene, integrator: bdpt, mlt }
}
