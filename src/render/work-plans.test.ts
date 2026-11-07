import { describe, expect, it } from 'vitest'
import { BandPlan, ChainPlan, type Job } from './work-plans'

function jobs(
  plan: BandPlan | ChainPlan,
  worker: number,
  limit: number | null,
  count: number,
): Job[] {
  const list: Job[] = []
  for (let i = 0; i < count; i++) {
    const job = plan.next(worker, limit)
    if (!job) break
    list.push(job)
  }
  return list
}

describe('BandPlan', () => {
  it('covers every row once per pass, then starts the next pass', () => {
    const bands = jobs(new BandPlan(20), 0, null, 4).map((job) => job.job)
    expect(bands).toEqual([
      { pass: 0, firstRow: 0, rowCount: 8 },
      { pass: 0, firstRow: 8, rowCount: 8 },
      { pass: 0, firstRow: 16, rowCount: 4 },
      { pass: 1, firstRow: 0, rowCount: 8 },
    ])
  })

  it('stops at the sample limit', () => {
    expect(jobs(new BandPlan(16), 0, 2, 100)).toHaveLength(4)
  })
})

describe('ChainPlan', () => {
  it('keeps every chain with one worker - chain k goes to worker k mod workers', () => {
    const workers = 3
    const plan = new ChainPlan(workers, 1_000_000)
    for (let worker = 0; worker < workers; worker++) {
      for (const job of jobs(plan, worker, null, 100)) {
        if (job.type !== 'run-chain') throw new Error('expected a chain job')
        expect(job.job.chain % workers).toBe(worker)
      }
    }
  })

  it('hands out exactly the sample limit in mutations', () => {
    const pixels = 10_000
    const plan = new ChainPlan(2, pixels)
    let mutations = 0
    for (let worker = 0; ; worker = 1 - worker) {
      const job = plan.next(worker, 3)
      if (!job) break
      if (job.type === 'run-chain') mutations += job.job.mutations
    }
    expect(mutations).toBe(3 * pixels)
  })
})
