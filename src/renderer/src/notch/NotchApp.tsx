import { useEffect, useState } from 'react'
import '../styles/theme.css'
import { useSnapshot } from '../lib/useSnapshot'

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
        border: '1px solid var(--line)',
        borderTop: 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'opacity 150ms linear'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px', height: 33, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 8 }} className="accent">
          {running ? `▶ ${running.info.label}` : 'V.A.U.L.T.'}
        </span>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 8 }} className={snap && snap.usage.percent > 80 ? '' : 'dim'} data-danger={!!snap && snap.usage.percent > 80}>
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
              style={{ fontSize: 9, padding: '5px 7px', boxShadow: 'none' }}
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
