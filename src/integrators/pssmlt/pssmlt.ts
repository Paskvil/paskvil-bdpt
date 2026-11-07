import type { SplatSink } from '../../film/sample-sink'
import { Sfc32, type Random } from '../../rng/random'
import type { Integrator } from '../integrator'
import { PrimarySampleSpace, type MutationOptions } from './primary-sample-space'
import { RecordingSink } from './recording-sink'

export interface PssmltOptions extends MutationOptions {
  /** independent samples taken first - for the image's overall brightness and the chains' starts */
  bootstrapSamples: number
  /** all randomness derives from it - a different seed gives an independent render */
  seed: number
}

/** a sample of the wrapped integrator, as one point of a Markov chain */
type ChainState = RecordingSink

interface Chain {
  space: PrimarySampleSpace
  current: ChainState
  /** decides on acceptance - separate from the numbers the paths are built from */
  random: Random
}

/** bootstrap sample i and chain i draw from separate seeds, all derived from the render's seed */
function bootstrapSeed(seed: number, index: number): number {
  return Math.imul(seed, 0x9e3779b1) ^ index
}

function chainSeed(seed: number, index: number): number {
  return Math.imul(seed, 0x9e3779b1) ^ (0x4000_0000 + index)
}

/**
 * primary sample space Metropolis light transport (Kelemen et al. 2002) - on top of any
 * integrator, here BDPT, without changing it
 *
 * a sample of the integrator is a function of the "random" numbers it consumes. instead of fresh
 * numbers each time, a Markov chain mutates the vector of numbers a little and keeps the change
 * with probability min(1, new brightness / current brightness) - so the chain spends its time on
 * bright paths, and once it finds a hard one (a caustic seen in a mirror...) it explores the
 * neighbouring paths instead of losing it again
 *
 * the chain visits paths in proportion to their brightness, not to their probability - so each
 * visit adds its light divided by its brightness, times `brightness`, the image's average
 * brightness, estimated up front by plain sampling (the bootstrap)
 */
export class Pssmlt {
  /** b - the average brightness of a sample, over the whole image */
  readonly brightness: number
  /** running sum of the bootstrap samples' brightness - picks the chains' starting points */
  private readonly cumulativeBootstrap: number[] = []
  private readonly chains = new Map<number, Chain>()

  constructor(
    private readonly integrator: Integrator,
    private readonly width: number,
    private readonly height: number,
    private readonly options: PssmltOptions,
  ) {
    let total = 0
    for (let index = 0; index < options.bootstrapSamples; index++) {
      const space = new PrimarySampleSpace(bootstrapSeed(options.seed, index), options)
      total += this.evaluate(space).luminance
      this.cumulativeBootstrap.push(total)
    }
    this.brightness = total / options.bootstrapSamples
  }

  /** advances chain `index` by `mutations` steps, splatting the light it finds into `sink` */
  runChain(index: number, mutations: number, sink: SplatSink): void {
    if (this.brightness === 0) return
    const chain = this.chains.get(index) ?? this.startChain(index)

    for (let step = 0; step < mutations; step++) {
      chain.space.startIteration()
      const proposed = this.evaluate(chain.space)
      const acceptance = Math.min(1, proposed.luminance / chain.current.luminance)

      // both states get their share of this step's light ("expected value" splatting) - less
      // noise than adding just the one the chain ends up in
      this.splat(sink, proposed, acceptance)
      this.splat(sink, chain.current, 1 - acceptance)

      if (chain.random.next() < acceptance) {
        chain.current = proposed
        chain.space.accept()
      } else {
        chain.space.reject()
      }
    }
  }

  /**
   * a new chain starts at one of the bootstrap samples, picked in proportion to its brightness -
   * as if the chain had already been running for a long time (no warm-up bias)
   */
  private startChain(index: number): Chain {
    const random = new Sfc32(chainSeed(this.options.seed, index))
    const target = random.next() * this.brightness * this.options.bootstrapSamples
    const start = this.cumulativeBootstrap.findIndex((runningTotal) => runningTotal > target)

    // the same seed rebuilds the same vector, so this re-evaluates that very bootstrap sample
    const space = new PrimarySampleSpace(bootstrapSeed(this.options.seed, start), this.options)
    const chain = { space, current: this.evaluate(space), random }
    this.chains.set(index, chain)
    return chain
  }

  /** one sample of the wrapped integrator - the first two numbers pick the pixel */
  private evaluate(numbers: Random): ChainState {
    const x = Math.floor(numbers.next() * this.width)
    const y = Math.floor(numbers.next() * this.height)
    const recording = new RecordingSink()
    this.integrator.renderSample(x, y, recording, numbers)
    return recording
  }

  private splat(sink: SplatSink, state: ChainState, share: number): void {
    if (share <= 0 || state.luminance === 0) return
    const scale = (share * this.brightness) / state.luminance
    for (const { filmX, filmY, radiance } of state.contributions) {
      sink.addSplat(filmX, filmY, radiance.scale(scale))
    }
  }
}
