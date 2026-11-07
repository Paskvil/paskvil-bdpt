import { SplatList } from '../film/splat-list'
import { renderBand } from './band'
import type { FromWorker, ToWorker } from './messages'
import { createRenderSetup, type RenderSetup, type RenderSettings } from './settings'

/**
 * worker entry point - builds the scene from the settings, then renders bands (path tracing,
 * BDPT) or advances Markov chains (PSSMLT) on request
 *
 * `self` is typed for the DOM here (the project uses the DOM lib, and it can't be combined with
 * the WebWorker lib), hence the small local interface instead
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null
  postMessage(message: FromWorker, transfer: Transferable[]): void
}
const scope = self as unknown as WorkerScope

let generation = -1
let settings: RenderSettings | null = null
let setup: RenderSetup | null = null

scope.onmessage = ({ data: message }) => {
  if (message.type === 'configure') {
    generation = message.generation
    settings = message.settings
    // for PSSMLT this includes the bootstrap - jobs sent meanwhile simply queue up
    setup = createRenderSetup(settings)
    return
  }

  // stale job, queued before the latest configure - the main thread would drop the result anyway
  if (message.generation !== generation || !setup || !settings) return

  switch (message.type) {
    case 'render-band': {
      const band = renderBand(setup.scene, setup.integrator, settings.width, message.job)
      const splats = band.splatList()
      const { sums, raysCast } = band
      scope.postMessage({ type: 'band', generation, job: message.job, sums, splats, raysCast }, [
        sums.buffer,
        splats.buffer,
      ])
      break
    }

    case 'run-chain': {
      if (!setup.mlt) return
      const list = new SplatList(settings.width)
      const raysBefore = setup.scene.raysCast
      setup.mlt.runChain(message.job.chain, message.job.mutations, list)
      const splats = list.toFloat32Array()
      const raysCast = setup.scene.raysCast - raysBefore
      scope.postMessage({ type: 'chain', generation, job: message.job, splats, raysCast }, [
        splats.buffer,
      ])
      break
    }
  }
}
