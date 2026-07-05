import { describe, it, expect } from 'vitest'
import { parseJsonlUsage, computeWindowUsage, computeCpuUsage, collectUsage } from '../src/main/collectors/usage'
import { buildDefaultConfig } from '../src/main/config'

const line = (ts: string, input: number, output: number, cacheW = 0) =>
  JSON.stringify({
    timestamp: ts,
    message: {
      usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: cacheW }
    }
  })

describe('parseJsonlUsage', () => {
  it('extracts timestamped token totals from anthropic-style lines', () => {
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

  it('tolerates other CLI session shapes (nested usage, unix-second ts)', () => {
    const codexish = JSON.stringify({
      ts: 1782200000, // unix seconds
      payload: { type: 'token_count', info: { last_token_usage: { input_tokens: 40, output_tokens: 8 } } }
    })
    const entries = parseJsonlUsage(codexish)
    expect(entries).toEqual([{ ts: 1782200000 * 1000, tokens: 48 }])
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
    const usage = computeWindowUsage(entries, now, 5 * h, 1000, 'anthropic')
    expect(usage.windowTokens).toBe(500)
    expect(usage.percent).toBe(50)
    expect(usage.updatedAt).toBe(now)
    expect(usage.provider).toBe('anthropic')
    expect(usage.mode).toBe('tokens')
  })
  it('caps percent at 100', () => {
    const usage = computeWindowUsage([{ ts: 10, tokens: 5000 }], 20, 100, 1000, 'openai')
    expect(usage.percent).toBe(100)
  })
})

describe('computeCpuUsage', () => {
  it('converts load average to a core-normalized percent', () => {
    const usage = computeCpuUsage(4, 8, 123)
    expect(usage).toEqual({ provider: 'ollama', mode: 'cpu', windowTokens: 0, percent: 50, cores: 8, updatedAt: 123 })
  })
  it('caps at 100 and survives zero cores', () => {
    expect(computeCpuUsage(20, 8, 1).percent).toBe(100)
    expect(computeCpuUsage(1, 0, 1).percent).toBe(0)
  })
})

describe('collectUsage fail-soft', () => {
  it('resolves to a valid shape without throwing for each provider', async () => {
    for (const provider of ['anthropic', 'openai', 'ollama'] as const) {
      const config = buildDefaultConfig({ home: '/u', vaultPath: null, repoDirs: [] })
      config.ai.provider = provider
      const usage = await collectUsage(config)
      expect(usage.windowTokens).toBeGreaterThanOrEqual(0)
      expect(usage.percent).toBeGreaterThanOrEqual(0)
      expect(usage.percent).toBeLessThanOrEqual(100)
      expect(usage.updatedAt).toBeGreaterThan(0)
      expect(usage.provider).toBe(provider)
    }
  })
})
