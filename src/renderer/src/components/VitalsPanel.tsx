import type { ClaudeUsage, RepoStats } from '@shared/types'
import { Panel } from './Panel'
import { Sparkline } from './Sparkline'

export function VitalsPanel({ repos, usage }: { repos: RepoStats[]; usage: ClaudeUsage }) {
  const active = [...repos].sort((a, b) => b.commitsWeek - a.commitsWeek).slice(0, 4)
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
          <div><span className="dim">▸ </span>CLAUDE 5H WINDOW</div>
          <div className="dim" style={{ fontSize: 10 }}>{Math.round(usage.windowTokens / 1000)}K tokens</div>
        </div>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14 }} className={usage.percent > 80 ? '' : 'accent'} data-danger={usage.percent > 80}>
          {usage.percent}%
        </div>
      </div>
    </Panel>
  )
}
