import { useSnapshot } from '../lib/useSnapshot'
import { Panel } from '../components/Panel'
import { VitalsPanel } from '../components/VitalsPanel'
import { CommandDeck } from '../components/CommandDeck'
import { DirectivesPanel } from '../components/DirectivesPanel'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { SchedulePanel } from '../components/SchedulePanel'
import { PrimaryDirective } from '../components/PrimaryDirective'
import { Clock } from '../components/Clock'
import { Mascot } from '../components/Mascot'

export default function App() {
  const snap = useSnapshot()
  if (!snap) return <p style={{ padding: 16 }}>booting…</p>
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 300px',
        gridTemplateRows: snap.configCreated ? '40px auto 1fr' : '40px 1fr',
        gap: 8,
        height: '100vh',
        padding: 8
      }}
    >
      <header style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dotted var(--line-soft)', paddingBottom: 4 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, color: 'var(--ink)' }}>{snap.appName}</div>
          <div className="dim" style={{ fontSize: 9 }}>VOICE-FREE UNIFIED LOGIC TERMINAL</div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 10 }} className="dim">
          <span>
            <span className={snap.commands.some((c) => c.status.state === 'running') ? 'clay' : 'dim'}>●</span> CORE ·{' '}
            {snap.commands.some((c) => c.status.state === 'running') ? 'BUSY' : 'IDLE'}
          </span>
          <span>
            <span className={snap.docs.length > 0 || snap.directives.length > 0 ? 'clay' : 'dim'}>●</span> VAULT ·{' '}
            {snap.docs.length > 0 || snap.directives.length > 0 ? 'LINKED' : 'EMPTY'}
          </span>
          <span>
            <span className={snap.repos.filter((r) => r.branch !== '—').length > 0 ? 'clay' : 'dim'}>●</span> GIT ·{' '}
            {snap.repos.filter((r) => r.branch !== '—').length}/{snap.repos.length}
          </span>
        </div>
        <Clock />
      </header>
      {snap.configCreated && (
        <div
          style={{
            gridColumn: '1 / -1',
            border: '1px solid var(--line)',
            background: 'var(--panel)',
            padding: '6px 10px',
            fontSize: 11
          }}
        >
          <span className="clay">CONFIG CREATED</span> — edit <span className="clay">{snap.configPath}</span> to
          prune repos, set your vault path, and tune the primary directive. Restart after editing.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflowY: 'auto' }}>
        <VitalsPanel repos={snap.repos} usage={snap.usage} />
        <DirectivesPanel directives={snap.directives} />
        <DocumentsPanel docs={snap.docs} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <Panel title="Core" corner="ALIVE" style={{ flex: 1 }}>
          <Mascot usagePercent={snap.usage.percent} />
          <div style={{ borderTop: '1px dotted var(--line-soft)', paddingTop: 8 }}>
            <PrimaryDirective {...snap.primary} />
          </div>
        </Panel>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflowY: 'auto' }}>
        <CommandDeck commands={snap.commands} />
        <SchedulePanel schedule={snap.schedule} />
      </div>
    </div>
  )
}
