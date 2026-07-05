import { describe, it, expect } from 'vitest'
import { fmtUptime, bar, dots, fetchLines } from '../src/renderer/src/lib/fetchLines'
import type { HudSnapshot } from '../src/shared/types'

describe('formatters', () => {
  it('fmtUptime picks the right unit', () => {
    expect(fmtUptime(45_000)).toBe('45s')
    expect(fmtUptime(12 * 60_000)).toBe('12m')
    expect(fmtUptime(3 * 3600_000 + 12 * 60_000)).toBe('3h 12m')
  })
  it('bar fills proportionally to width', () => {
    expect(bar(0, 5)).toBe('░░░░░')
    expect(bar(100, 5)).toBe('▓▓▓▓▓')
    expect(bar(40, 5)).toBe('▓▓░░░')
  })
  it('dots fills n of width', () => {
    expect(dots(4, 7, 5)).toBe('●●●●○')
    expect(dots(9, 9, 5)).toBe('●●●●●')
  })
})

const snap = {
  appName: 'vault',
  bootAt: 1_000,
  repos: [{ dirtyFiles: 2 } as any, { dirtyFiles: 0 } as any],
  usage: { provider: 'anthropic', mode: 'tokens', percent: 27, windowTokens: 0, updatedAt: 0 },
  primary: { label: '', value: 45, target: 30, unit: '' },
  directives: [{ done: true } as any, { done: true } as any, { done: false } as any],
  mood: 'happy',
  pet: { name: 'kimani', xp: 0 }
} as unknown as HudSnapshot

describe('fetchLines', () => {
  it('emits only the requested ids, in order', () => {
    const out = fetchLines(snap, 1_000 + 60_000, ['repos', 'uptime'])
    expect(out.map((l) => l.id)).toEqual(['repos', 'uptime'])
    expect(out[0].value).toBe('2 · 2✗') // 2 repos, 2 dirty total
    expect(out[1].value).toBe('1m')
  })
  it('formats streak, tokens, commits, provider, mood', () => {
    const byId = Object.fromEntries(
      fetchLines(snap, snap.bootAt, ['streak', 'tokens', 'commits', 'provider', 'mood']).map((l) => [l.id, l.value])
    )
    expect(byId.streak).toBe('●●○○○ 2d')
    expect(byId.tokens).toBe('▓░░░░ 27%')
    expect(byId.commits).toBe('45/30 ↑')
    expect(byId.provider).toBe('anthropic')
    expect(byId.mood).toBe('focused')
  })
})
