import { renderBand } from './band'
import type { FromWorker, ToWorker } from './messages'
import { createRenderSetup, type RenderSetup, type RenderSettings } from './settings'

/**
 * worker entry point - builds the scene from the settings, then renders bands on request
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
  switch (message.type) {
    case 'configure':
      generation = message.generation
      settings = message.settings
      setup = createRenderSetup(settings)
      break

    case 'render': {
      // stale job, queued before the latest configure - the main thread would drop the result anyway
      if (message.generation !== generation || !setup || !settings) return
      const band = renderBand(setup.scene, setup.integrator, settings.width, message.job)
      const splats = band.splatList()
      const reply: FromWorker = {
        type: 'band',
        generation,
        job: message.job,
        sums: band.sums,
        splats,
        raysCast: band.raysCast,
      }
      scope.postMessage(reply, [band.sums.buffer, splats.buffer])
      break
    }
  }
}
