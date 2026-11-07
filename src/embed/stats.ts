import type { RenderStats } from '../render/parallel-renderer'
import { DEFAULT_ADVANCED, INTEGRATOR_NAMES, usesBdpt, type DemoControls } from './demo-controls'

export interface Stat {
  /** short label shown on the render - "SPP" */
  label: string
  value: string
  /** shown on hover */
  description: string
}

/** the stats shown on the render and in the PNG strip, in display order */
export function formatStats(stats: RenderStats, controls: DemoControls): Stat[] {
  const seconds = stats.renderTimeMs / 1000
  const list: Stat[] = [
    {
      label: 'SPP',
      value: stats.samplesPerPixel.toFixed(1),
      description:
        controls.integrator === 'pssmlt'
          ? 'samples per pixel - for PSSMLT, mutations per pixel: each a BDPT sample proposed by a Markov chain'
          : 'samples per pixel - camera paths averaged into each pixel so far',
    },
    {
      label: 'RAYS',
      value: compact(stats.raysCast),
      description: 'rays cast - every ray tested against the scene, shadow rays included',
    },
    {
      label: 'R/S',
      value: compact(seconds > 0 ? stats.raysCast / seconds : 0),
      description: 'rays per second - over all workers',
    },
    {
      label: 'TIME',
      value: duration(seconds),
      description: 'render time - since the last change, not counting pauses',
    },
  ]
  if (usesBdpt(controls.integrator)) {
    list.push({
      label: 'LP',
      value: compact(stats.sampleCount),
      description: 'light paths - traced from the lights, one for every camera sample',
    })
  }
  return list
}

/**
 * the algorithm and the scene in short lines - for the PNG strip; one more line lists the
 * advanced settings that differ from the defaults
 */
export function describeSettings(controls: DemoControls): string[] {
  const lights = Object.entries(controls.lights)
    .filter(([, on]) => on)
    .map(([name]) => (name === 'top' && controls.topShade ? 'top (shaded)' : name))
    .join(' + ')
  const { left, right } = controls.balls
  const lines = [
    INTEGRATOR_NAMES[controls.integrator].full,
    `lights ${lights}`,
    `left ball ${left} · right ball ${right}`,
  ]
  const advanced = describeAdvanced(controls)
  return advanced ? [...lines, advanced] : lines
}

function describeAdvanced({ integrator, advanced }: DemoControls): string {
  const parts: string[] = []
  if (advanced.maxDepth !== DEFAULT_ADVANCED.maxDepth) parts.push(`max depth ${advanced.maxDepth}`)
  if (usesBdpt(integrator)) {
    if (advanced.heuristic !== DEFAULT_ADVANCED.heuristic) parts.push(`mis ${advanced.heuristic}`)
    const { strategy } = advanced
    if (strategy) {
      const weighting = strategy.weighted ? 'weighted' : 'unweighted'
      parts.push(`only (s, t) = (${strategy.s}, ${strategy.t}) ${weighting}`)
    }
  }
  return parts.join(' · ')
}

/** 12.3k, 4.56M, 1.2G */
function compact(value: number): string {
  const units: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
  ]
  for (const [size, suffix] of units) {
    if (value >= size) return `${(value / size).toPrecision(3)}${suffix}`
  }
  return String(Math.round(value))
}

/** m:ss */
function duration(seconds: number): string {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * shows the stats in the overlay's `<dl>` - only the values change between updates, the entries
 * are rebuilt just when the set of stats does (keeps hover tooltips from flickering)
 */
export function showStats(list: HTMLElement, stats: Stat[]): void {
  const labels = stats.map((stat) => stat.label).join()
  if (list.dataset.labels !== labels) {
    list.dataset.labels = labels
    list.replaceChildren(
      ...stats.map((stat) => {
        const entry = document.createElement('div')
        entry.title = stat.description
        entry.append(document.createElement('dt'), document.createElement('dd'))
        return entry
      }),
    )
  }
  stats.forEach((stat, index) => {
    const [label, value] = list.children[index].children
    label.textContent = stat.label
    value.textContent = stat.value
  })
}
