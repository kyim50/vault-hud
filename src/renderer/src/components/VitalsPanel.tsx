import type { AudioConfig, AudioMode, RepoStats, UsageStats } from '@shared/types'
import { Panel } from './Panel'
import { Sparkline } from './Sparkline'
import { lofi } from '../lib/audio'

const MODES: AudioMode[] = ['off', 'hum', 'hiss']

export function VitalsPanel({ repos, usage, audio }: { repos: RepoStats[]; usage: UsageStats; audio?: AudioConfig }) {
  const active = [...repos].sort((a, b) => b.commitsWeek - a.commitsWeek).slice(0, 4)
  const cpuMode = usage.mode === 'cpu'
  const a: AudioConfig = audio ?? { mode: 'off', volume: 40 }
  const setAudio = (patch: Partial<AudioConfig>): void => {
    const next = { ...a, ...patch }
    lofi.apply(next) // instant, before the config round-trip
    window.vault.updateConfig({ ui: { audio: next } })
  }
  return (
    <Panel title="System Vitals" corner="LIVE">
      {active.map((r) => (
        <div key={r.path} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span className="dim">▸ </span>{r.name}
            </div>
            <div className="dim" style={{ fontSize: 10 }}>
              {r.branch} · {r.commitsWeek}/wk{r.dirtyFiles > 0 ? ` · ${r.dirtyFiles} dirty` : ''}
            </div>
          </div>
          <Sparkline data={r.daily} />
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div><span className="dim">▸ </span>{cpuMode ? 'LOCAL CPU' : 'TOKEN WINDOW'}</div>
          <div className="dim" style={{ fontSize: 10 }}>
            {cpuMode ? `${usage.cores ?? 0} cores · local model` : `${Math.round(usage.windowTokens / 1000)}K tokens · ${usage.provider}`}
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14 }} className={usage.percent > 80 ? '' : 'accent'} data-danger={usage.percent > 80}>
          {usage.percent}%
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
        <div><span className="dim">▸ </span>AMBIENT</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span
            className="dim"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            title="click to change volume"
            onClick={() => setAudio({ volume: (a.volume + 20) % 120 })}
          >
            [VOL: {a.volume}%]
          </span>
          <span
            className={a.mode === 'off' ? 'dim' : 'clay'}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            title="cycle ambient bed: off → fan hum → tape hiss"
            onClick={() => setAudio({ mode: MODES[(MODES.indexOf(a.mode) + 1) % MODES.length] })}
          >
            [{a.mode.toUpperCase()}]
          </span>
        </div>
      </div>
    </Panel>
  )
}
