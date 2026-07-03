import { describe, it, expect } from 'vitest'
import { parseCommitTimestamps, bucketDaily, countSince, collectRepoStats } from '../src/main/collectors/git'

describe('parseCommitTimestamps', () => {
  it('parses seconds lines into ms, skipping blanks', () => {
    expect(parseCommitTimestamps('1700000000\n\n1700000100\n')).toEqual([
      1700000000000, 1700000100000
    ])
  })
  it('returns empty for empty output', () => {
    expect(parseCommitTimestamps('')).toEqual([])
  })
})

describe('bucketDaily', () => {
  it('buckets commits into 7 local days, oldest first', () => {
    const now = new Date(2026, 6, 3, 15, 0, 0).getTime() // Jul 3 2026 local
    const day = 86_400_000
    const ts = [
      now - 10_000, // today → bucket 6
      now - 1 * day, // yesterday → bucket 5
      now - 1 * day - 5_000, // yesterday → bucket 5
      now - 6 * day, // oldest shown → bucket 0
      now - 30 * day // outside → dropped
    ]
    expect(bucketDaily(ts, now)).toEqual([1, 0, 0, 0, 0, 2, 1])
  })
})

describe('countSince', () => {
  it('counts timestamps at or after the boundary', () => {
    expect(countSince([100, 200, 300], 200)).toBe(2)
  })
})

describe('collectRepoStats fail-soft', () => {
  it('returns empty stats for a non-repo path without throwing', async () => {
    const stats = await collectRepoStats({ name: 'ghost', path: '/tmp/definitely-not-a-repo-xyz' })
    expect(stats).toEqual({
      name: 'ghost', path: '/tmp/definitely-not-a-repo-xyz', branch: '—',
      commitsToday: 0, commitsWeek: 0, dirtyFiles: 0,
      lastCommit: '', daily: [0, 0, 0, 0, 0, 0, 0]
    })
  })
})
