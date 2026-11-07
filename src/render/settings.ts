import type { Integrator } from '../integrators/integrator'
import { PathTracer } from '../integrators/path-tracer'
import { createCornellBox, type LightSwitches } from '../scene/cornell-box'
import type { Scene } from '../scene/scene'

/**
 * everything a render depends on, as plain data - it's what gets sent to the workers, each of
 * which builds its own scene and integrator from it (class instances can't be posted)
 */
export interface RenderSettings {
  width: number
  height: number
  lights: LightSwitches
  integrator: IntegratorSettings
}

export interface IntegratorSettings {
  kind: 'path-tracer'
  maxDepth: number
}

export interface RenderSetup {
  scene: Scene
  integrator: Integrator
}

export function createRenderSetup(settings: RenderSettings): RenderSetup {
  const scene = createCornellBox(settings)
  return { scene, integrator: createIntegrator(scene, settings.integrator) }
}

function createIntegrator(scene: Scene, settings: IntegratorSettings): Integrator {
  switch (settings.kind) {
    case 'path-tracer':
      return new PathTracer(scene, { maxDepth: settings.maxDepth })
  }
}
