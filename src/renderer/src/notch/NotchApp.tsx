import { useEffect, useState } from 'react'
import '../styles/theme.css'
import { useSnapshot } from '../lib/useSnapshot'

// The island stays black to blend with the hardware notch; text is the
// theme's cream, with clay reserved for the running state.
const CREAM = '#f4f2e9'
const CLAY = '#d97757'

export default function NotchApp() {
  const snap = useSnapshot()
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    window.vault.resizeNotch(expanded)
  }, [expanded])
  const running = snap?.commands.find((c) => c.status.state === 'running')
  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        height: '100vh',
        background: '#000',
        borderRadius: '0 0 14px 14px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'opacity 150ms linear',
        color: CREAM
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px', height: 33, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, color: running ? CLAY : CREAM }}>
          {running ? `▶ ${running.info.label}` : 'V.A.U.L.T.'}
        </span>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, color: snap && snap.usage.percent > 80 ? CLAY : '#8d8a7a' }}>
          ◉ {snap?.usage.percent ?? 0}%
        </span>
      </div>
      {expanded && snap && (
        <div style={{ padding: '4px 12px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {snap.commands.slice(0, 6).map(({ info, status }) => (
            <button
              key={info.id}
              onClick={() => window.vault.runCommand(info.id)}
              disabled={status.state === 'running' || status.state === 'queued'}
              style={{
                fontSize: 9,
                padding: '5px 7px',
                boxShadow: 'none',
                background: '#000',
                color: status.state === 'running' ? CLAY : CREAM,
                border: '1px solid #3a382e'
              }}
            >
              {status.state === 'running' ? '▶ ' : status.state === 'failed' ? '✕ ' : ''}
              {info.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
