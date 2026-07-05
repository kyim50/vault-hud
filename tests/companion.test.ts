import { describe, it, expect } from 'vitest'
import { computeMood, rollLoot, LOOT_TABLE } from '../src/main/companion'

const M = 60_000
describe('computeMood', () => {
  const now = 100 * 90 * M
  const churn = (spanMin: number, n: number) => Array.from({ length: n }, (_, i) => now - (i * spanMin * M) / (n - 1))

  it('naps when files churn for 90min with nothing checked off', () => {
    expect(computeMood(churn(80, 8), now - 120 * M, now)).toBe('napping')
  })
  it('stays happy when a directive was checked off recently', () => {
    expect(computeMood(churn(80, 8), now - 30 * M, now)).toBe('happy')
  })
  it('stays happy for short bursts or sparse activity', () => {
    expect(computeMood(churn(10, 8), now - 200 * M, now)).toBe('happy') // burst, not a grind
    expect(computeMood(churn(80, 3), now - 200 * M, now)).toBe('happy') // barely any changes
    expect(computeMood([], 0, now)).toBe('happy')
  })
  it('ignores activity older than the window', () => {
    const stale = Array.from({ length: 10 }, (_, i) => now - (100 + i * 10) * M)
    expect(computeMood(stale, 0, now)).toBe('happy')
  })
})

describe('rollLoot', () => {
  it('drops nothing when the roll misses', () => {
    expect(rollLoot(4000, [], () => 0.99)).toBeNull()
  })
  it('drops an unowned accessory when the roll hits', () => {
    const drop = rollLoot(4000, ['plant'], () => 0.1)
    expect(drop).not.toBeNull()
    expect(drop).not.toBe('plant')
    expect(LOOT_TABLE).toContain(drop)
  })
  it('bigger payloads raise the chance (capped)', () => {
    // rng 0.7: misses the base 0.2 chance, hits the capped 0.75 chance
    expect(rollLoot(0, [], () => 0.7)).toBeNull()
    expect(rollLoot(100_000, [], () => 0.7)).not.toBeNull()
  })
  it('returns null when everything is owned', () => {
    expect(rollLoot(100_000, [...LOOT_TABLE], () => 0)).toBeNull()
  })
})
