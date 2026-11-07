/** source of uniform random numbers in [0, 1) */
export interface Random {
  next(): number
}

/**
 * seedable PRNG - "sfc32" (Small Fast Counting) by Chris Doty-Humphrey, 128-bit state
 *
 * seedable so renders and tests are reproducible; a 32-bit generator (e.g. mulberry32) would
 * be simpler, but its 2^32 period runs out after a few hundred passes at 512x512
 */
export class Sfc32 implements Random {
  private a: number
  private b: number
  private c: number
  private d: number

  constructor(seed: number) {
    const next = splitMix32(seed)
    this.a = next()
    this.b = next()
    this.c = next()
    this.d = 1
    // discard the first outputs, they're poorly mixed
    for (let i = 0; i < 12; i++) this.nextUint32()
  }

  next(): number {
    return this.nextUint32() / 0x1_0000_0000
  }

  private nextUint32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0
    this.d = (this.d + 1) | 0
    this.a = this.b ^ (this.b >>> 9)
    this.b = (this.c + (this.c << 3)) | 0
    this.c = (this.c << 21) | (this.c >>> 11)
    this.c = (this.c + t) | 0
    return t >>> 0
  }
}

/** expands one seed into a stream of well-mixed 32-bit values, used to seed `Sfc32` */
function splitMix32(seed: number): () => number {
  let state = seed | 0
  return () => {
    state = (state + 0x9e3779b9) | 0
    let z = state
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b)
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35)
    return (z ^ (z >>> 16)) >>> 0
  }
}
