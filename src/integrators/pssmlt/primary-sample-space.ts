import { Sfc32, type Random } from '../../rng/random'

export interface MutationOptions {
  /** probability of a large step - every number replaced, a fresh independent sample */
  largeStepProbability: number
  /** typical size of a small step - each number nudged by a normal distribution this wide */
  smallStepSize: number
}

/** one number of the vector, with what's needed to undo its last change */
interface PrimarySample {
  value: number
  /** the iteration that last changed `value` */
  modifiedAt: number
  backup: number
  backupModifiedAt: number
}

/**
 * the "random" numbers of one Markov chain - Kelemen et al. 2002, PBRT's `MLTSampler`
 *
 * to the integrator it's just a `Random`: `next()` hands out the numbers of the current vector,
 * in order. between iterations the chain mutates the vector - a large step replaces every number,
 * a small step nudges each a little, so the path the integrator builds from them changes a little
 * too. `reject()` puts the previous vector back
 *
 * numbers are created lazily, the first time the integrator asks for them, and a number not used
 * for a while catches up on the steps it missed only when it's used again
 */
export class PrimarySampleSpace implements Random {
  private readonly samples: PrimarySample[] = []
  /** the source of the actual randomness - the mutations themselves */
  private readonly random: Random
  private iteration = 0
  private lastLargeStepAt = 0
  /** the very first vector is all fresh numbers - same as a large step */
  private largeStep = true
  private nextIndex = 0

  constructor(
    seed: number,
    private readonly options: MutationOptions,
  ) {
    this.random = new Sfc32(seed)
  }

  /** begins a mutation - the integrator then asks for numbers from the start of the vector */
  startIteration(): void {
    this.iteration++
    this.largeStep = this.random.next() < this.options.largeStepProbability
    this.nextIndex = 0
  }

  next(): number {
    const sample = this.ensureMutated(this.nextIndex++)
    return sample.value
  }

  /** the current vector, as far as it's been used - for tests and debugging */
  snapshot(): number[] {
    return this.samples.map((sample) => sample.value)
  }

  accept(): void {
    if (this.largeStep) this.lastLargeStepAt = this.iteration
  }

  /** undoes the current iteration's changes */
  reject(): void {
    for (const sample of this.samples) {
      if (sample.modifiedAt === this.iteration) {
        sample.value = sample.backup
        sample.modifiedAt = sample.backupModifiedAt
      }
    }
    this.iteration--
  }

  /** brings the number at `index` up to the current iteration */
  private ensureMutated(index: number): PrimarySample {
    while (this.samples.length <= index) {
      this.samples.push({ value: 0, modifiedAt: 0, backup: 0, backupModifiedAt: 0 })
    }
    const sample = this.samples[index]

    // missed a large step since it was last used - it would have been replaced then
    if (sample.modifiedAt < this.lastLargeStepAt) {
      sample.value = this.random.next()
      sample.modifiedAt = this.lastLargeStepAt
    }

    sample.backup = sample.value
    sample.backupModifiedAt = sample.modifiedAt
    if (this.largeStep) {
      sample.value = this.random.next()
    } else {
      // the small steps missed since the last use add up: their sizes combine as √n
      const missedSteps = this.iteration - sample.modifiedAt
      const step = this.normal() * this.options.smallStepSize * Math.sqrt(missedSteps)
      sample.value = wrap(sample.value + step)
    }
    sample.modifiedAt = this.iteration
    return sample
  }

  /** standard normal, Box-Muller */
  private normal(): number {
    const radius = Math.sqrt(-2 * Math.log(1 - this.random.next()))
    return radius * Math.cos(2 * Math.PI * this.random.next())
  }
}

/** keeps a number in [0, 1) by wrapping around - the primary sample space is a torus */
function wrap(value: number): number {
  return value - Math.floor(value)
}
