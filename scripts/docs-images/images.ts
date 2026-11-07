import type { RenderSettings } from '../../src/render/settings'
import type { BallMaterials, LightSwitches } from '../../src/scene/cornell-box'

/**
 * the images of the article at paskvil.com/projects/bdpt - one entry per PNG
 *
 * - `stop`: a fixed number of samples per pixel, or a time budget (for equal-time comparisons,
 *   which therefore depend on the machine - single-threaded, one image per CPU core)
 * - `exposure`: multiplies the light before the sRGB encoding - for faint single-strategy images
 * - `crop`: a region of the render, enlarged by an integer factor with crisp pixels
 */
export interface DocImage {
  name: string
  settings: RenderSettings
  stop: { samples: number } | { seconds: number }
  exposure?: number
  crop?: { x: number; y: number; width: number; height: number; scale: number }
}

const ALL_LIGHTS: LightSwitches = { top: true, left: true, right: true }
const TOP_LIGHT: LightSwitches = { top: true, left: false, right: false }
const MAX_DEPTH = 10

function bdpt(
  size: number,
  lights: LightSwitches,
  balls: BallMaterials,
  only: { s: number; t: number; weighted: boolean } | null = null,
): RenderSettings {
  return {
    width: size,
    height: size,
    lights,
    topShade: false,
    balls,
    integrator: { kind: 'bdpt', maxDepth: MAX_DEPTH, heuristic: 'power', only },
  }
}

function pathTracer(size: number, lights: LightSwitches, balls: BallMaterials): RenderSettings {
  return {
    width: size,
    height: size,
    lights,
    topShade: false,
    balls,
    integrator: { kind: 'path-tracer', maxDepth: MAX_DEPTH },
  }
}

/** single-threaded time per image - about what 30 s are in the browser, on 7-8 cores */
const SHADE_SECONDS = 150

/** top light only, behind its shade, diffuse balls - the scene of the PSSMLT section */
function shaded(kind: 'path-tracer' | 'bdpt' | 'pssmlt'): RenderSettings {
  return {
    width: 512,
    height: 512,
    lights: TOP_LIGHT,
    topShade: true,
    balls: { left: 'diffuse', right: 'diffuse' },
    integrator:
      kind === 'path-tracer'
        ? { kind, maxDepth: MAX_DEPTH }
        : { kind, maxDepth: MAX_DEPTH, heuristic: 'power', only: null },
  }
}

/** the scene of the strategy section: top light only, glass ball on the right */
const STRATEGY_BALLS: BallMaterials = { left: 'diffuse', right: 'glass' }
const STRATEGY_SAMPLES = 128

function strategy(s: number, t: number, weighted: boolean, exposure = 1): DocImage {
  return {
    name: `strategy-${s}-${t}-${weighted ? 'weighted' : 'unweighted'}`,
    settings: bdpt(256, TOP_LIGHT, STRATEGY_BALLS, { s, t, weighted }),
    stop: { samples: STRATEGY_SAMPLES },
    exposure,
  }
}

const COMPARE_BALLS: BallMaterials = { left: 'mirror', right: 'glass' }
const SDS_BALLS: BallMaterials = { left: 'mirror', right: 'mirror' }
const SDS_CROP = { x: 110, y: 300, width: 160, height: 140, scale: 2 }

export const DOC_IMAGES: DocImage[] = [
  // "where path tracing gives up" - equal time
  {
    name: 'compare-path-tracer',
    settings: pathTracer(512, ALL_LIGHTS, COMPARE_BALLS),
    stop: { seconds: 150 },
  },
  { name: 'compare-bdpt', settings: bdpt(512, ALL_LIGHTS, COMPARE_BALLS), stop: { seconds: 150 } },

  // "looking at one strategy"
  {
    name: 'strategy-all',
    settings: bdpt(256, TOP_LIGHT, STRATEGY_BALLS),
    stop: { samples: STRATEGY_SAMPLES },
  },
  ...[true, false].flatMap((weighted) => [
    strategy(0, 3, weighted),
    strategy(1, 2, weighted),
    strategy(2, 1, weighted),
  ]),
  // three bounces are faint - brightened 4×, as the captions say
  ...[
    [0, 5],
    [1, 4],
    [2, 3],
    [3, 2],
    [4, 1],
  ].map(([s, t]) => strategy(s, t, true, 4)),
  strategy(0, 5, false, 4),
  strategy(4, 1, false, 4),

  // "where BDPT struggles too" - equal samples, cropped around the left mirror ball
  {
    name: 'sds-path-tracer',
    settings: pathTracer(512, TOP_LIGHT, SDS_BALLS),
    stop: { samples: 60 },
    crop: SDS_CROP,
  },
  {
    name: 'sds-bdpt',
    settings: bdpt(512, TOP_LIGHT, SDS_BALLS),
    stop: { samples: 60 },
    crop: SDS_CROP,
  },

  // "the lamp shade" - the scene that's hard for path tracing, equal time, all three algorithms
  ...(['path-tracer', 'bdpt', 'pssmlt'] as const).map((kind): DocImage => ({
    name: `shade-${kind}`,
    settings: shaded(kind),
    stop: { seconds: SHADE_SECONDS },
  })),
  // PSSMLT's noise up close - blotches rather than salt
  {
    name: 'shade-pssmlt-crop',
    settings: shaded('pssmlt'),
    stop: { seconds: SHADE_SECONDS },
    crop: { x: 96, y: 300, width: 160, height: 140, scale: 2 },
  },
  {
    name: 'shade-bdpt-crop',
    settings: shaded('bdpt'),
    stop: { seconds: SHADE_SECONDS },
    crop: { x: 96, y: 300, width: 160, height: 140, scale: 2 },
  },
]
