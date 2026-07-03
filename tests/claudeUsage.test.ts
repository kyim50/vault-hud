import { describe, it, expect } from 'vitest'
import { parseJsonlUsage, computeWindowUsage } from '../src/main/collectors/claudeUsage'

const line = (ts: string, input: number, output: number, cacheW = 0) =>
  JSON.stringify({
    timestamp: ts,
    message: {
      usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: cacheW }
    }
  })

describe('parseJsonlUsage', () => {
  it('extracts timestamped token totals from assistant lines', () => {
    const content = [
      line('2026-07-03T10:00:00.000Z', 100, 50, 25),
      '{"type":"summary","summary":"no usage here"}',
      'garbage not json',
      line('2026-07-03T11:00:00.000Z', 10, 5)
    ].join('\n')
    const entries = parseJsonlUsage(content)
    expect(entries).toEqual([
      { ts: Date.parse('2026-07-03T10:00:00.000Z'), tokens: 175 },
      { ts: Date.parse('2026-07-03T11:00:00.000Z'), tokens: 15 }
    ])
  })
})

describe('computeWindowUsage', () => {
  it('sums only entries inside the rolling window and computes percent', () => {
    const now = Date.parse('2026-07-03T12:00:00.000Z')
    const h = 3_600_000
    const entries = [
      { ts: now - 6 * h, tokens: 999 }, // outside 5h window
      { ts: now - 4 * h, tokens: 300 },
      { ts: now - 1 * h, tokens: 200 }
    ]
    const usage = computeWindowUsage(entries, now, 5 * h, 1000)
    expect(usage.windowTokens).toBe(500)
    expect(usage.percent).toBe(50)
    expect(usage.updatedAt).toBe(now)
  })
  it('caps percent at 100', () => {
    const usage = computeWindowUsage([{ ts: 10, tokens: 5000 }], 20, 100, 1000)
    expect(usage.percent).toBe(100)
  })
})
