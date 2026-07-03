import { useSnapshot } from '../lib/useSnapshot'
import { Panel } from '../components/Panel'

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
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 16 }} className="accent" id="clock" />
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto' }}>
        <Panel title="System Vitals" corner="LIVE">vitals…</Panel>
        <Panel title="Directives" corner="TOP 3">directives…</Panel>
        <Panel title="Documents" corner="TRAIL">docs…</Panel>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <Panel title="Core" corner="ALIVE">
          <div style={{ flex: 1 }}>sprite…</div>
        </Panel>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: 'auto' }}>
        <Panel title="Command Deck" corner={`${snap.commands.length} LOADED`}>deck…</Panel>
        <Panel title="Schedule" corner="TODAY">schedule…</Panel>
      </div>
    </div>
  )
}
