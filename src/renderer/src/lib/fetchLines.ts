import type { HudSnapshot } from '@shared/types'

export type FetchLineId = 'uptime' | 'repos' | 'tokens' | 'commits' | 'provider' | 'streak' | 'mood'

export interface FetchLine {
  id: FetchLineId
  label: string
  value: string
}

export function fmtUptime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

export function bar(pct: number, width: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width)
  return '▓'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

export function dots(n: number, _total: number, width: number): string {
  const filled = Math.max(0, Math.min(width, n))
  return '●'.repeat(filled) + '○'.repeat(Math.max(0, width - filled))
}

// Build the requested spec lines (only those ids, in the given order) from a
// snapshot. `now` is injected so this stays pure/testable.
export function fetchLines(snap: HudSnapshot, now: number, ids: FetchLineId[]): FetchLine[] {
  const dirty = snap.repos.reduce((sum, r) => sum + r.dirtyFiles, 0)
  const done = snap.directives.filter((d) => d.done).length
  const cpu = snap.usage.mode === 'cpu'
  const line = (id: FetchLineId): FetchLine => {
    switch (id) {
      case 'uptime':
        return { id, label: 'uptime', value: fmtUptime(now - snap.bootAt) }
      case 'repos':
        return { id, label: 'repos', value: `${snap.repos.length} · ${dirty}✗` }
      case 'tokens':
        return { id, label: cpu ? 'cpu' : 'tokens', value: `${bar(snap.usage.percent, 5)} ${snap.usage.percent}%` }
      case 'commits':
        return { id, label: 'commits', value: `${snap.primary.value}/${snap.primary.target} ↑` }
      case 'provider':
        return { id, label: 'provider', value: snap.usage.provider }
      case 'streak':
        return { id, label: 'streak', value: `${dots(done, snap.directives.length, 5)} ${done}d` }
      case 'mood':
        return { id, label: 'mood', value: snap.mood === 'napping' ? 'napping 💤' : 'focused' }
    }
  }
  return ids.map(line)
}
