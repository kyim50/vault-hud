import { useSnapshot } from '../lib/useSnapshot'
import { Panel } from '../components/Panel'
import { VitalsPanel } from '../components/VitalsPanel'
import { DirectivesPanel } from '../components/DirectivesPanel'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { SchedulePanel } from '../components/SchedulePanel'
import { PrimaryDirective } from '../components/PrimaryDirective'
import { Clock } from '../components/Clock'

export default function App() {
  const snap = useSnapshot()
  if (!snap) return <p style={{ padding: 20 }}>booting…</p>
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr 320px',
        gridTemplateRows: '48px 1fr',
        gap: 10,
        height: '100vh',
        padding: 10
      }}
    >
      <header style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: 'var(--ink)' }}>{snap.appName}</div>
          <div className="dim" style={{ fontSize: 10 }}>VOICE-FREE UNIFIED LOGIC TERMINAL</div>
        </div>
        <Clock />
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto' }}>
        <VitalsPanel repos={snap.repos} usage={snap.usage} />
        <DirectivesPanel directives={snap.directives} />
        <DocumentsPanel docs={snap.docs} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <Panel title="Core" corner="ALIVE">
          <div style={{ flex: 1 }} />
        </Panel>
        <PrimaryDirective {...snap.primary} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto' }}>
        <Panel title="Command Deck" corner={`${snap.commands.length} LOADED`}>deck…</Panel>
        <SchedulePanel schedule={snap.schedule} />
      </div>
    </div>
  )
}
