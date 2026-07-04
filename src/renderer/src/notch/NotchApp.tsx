import { useEffect, useRef, useState } from 'react'
import '../styles/theme.css'
import { useSnapshot } from '../lib/useSnapshot'

// Boring Notch-style island: collapsed strip that blends with the hardware
// notch; hover expands to artwork tile + tabbed details about your Claude.
const CREAM = '#f4f2e9'
const CLAY = '#d97757'
const DARK_CLAY = '#b85c3f'
const DIM = '#8d8a7a'
const EDGE = '#3a382e'

const TABS = ['STATUS', 'PLAN', 'GIT', 'RUN'] as const
type Tab = (typeof TABS)[number]

// mini artwork: the critter bobbing/blinking on a dotted floor, album-art style
function MiniMascot() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!
    const SPR = [
      '.nn........nn.',
      '.nnBBBBBBBBnn.',
      'BBBBBBBBBBBBDD',
      'BBEBBBBBBEBBDD',
      'BBEBBBBBBEBBDD',
      'BBBBBBBBBBBBDD',
      'BBBBBBBBBBBBDD',
      '.BBBBBBBBBBDD.',
      '.L.LL....LL.L.'
    ]
    let f = 0
    const draw = (): void => {
      ctx.clearRect(0, 0, 44, 44)
      ctx.fillStyle = CREAM
      for (let x = 2; x < 42; x += 3) {
        if ((x * 7) % 5 > 1) ctx.fillRect(x, 40, 1, 1)
      }
      const bob = Math.floor(f / 5) % 2
      const blink = f % 40 >= 36
      for (let r = 0; r < SPR.length; r++) {
        for (let c = 0; c < SPR[r].length; c++) {
          const ch = SPR[r][c]
          if (ch === '.') continue
          ctx.fillStyle = ch === 'E' ? (blink ? CLAY : '#17160f') : ch === 'D' || ch === 'n' ? DARK_CLAY : CLAY
          ctx.fillRect(8 + c * 2, 6 + r * 2 + bob, 2, 2)
        }
      }
      f++
    }
    draw()
    const t = setInterval(draw, 1000 / 10)
    return () => clearInterval(t)
  }, [])
  return (
    <canvas
      ref={ref}
      width={44}
      height={44}
      style={{ width: 88, height: 88, imageRendering: 'pixelated', background: '#151510', border: `1px solid ${EDGE}`, borderRadius: 8 }}
    />
  )
}

// the main process passes the real menu-bar height in the URL hash
const NOTCH_H = Math.max(24, Number(new URLSearchParams(window.location.hash.slice(1)).get('mh')) || 37)

export default function NotchApp() {
  const snap = useSnapshot()
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<Tab>('STATUS')
  useEffect(() => {
    window.vault.resizeNotch(expanded)
  }, [expanded])
  // while dormant the window forwards mousemoves without capturing clicks —
  // expand only when the pointer is actually in the notch strip
  useEffect(() => {
    if (expanded) return
    const onMove = (e: MouseEvent): void => {
      const cx = window.innerWidth / 2
      if (e.clientY <= NOTCH_H + 2 && Math.abs(e.clientX - cx) < 130) setExpanded(true)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [expanded])
  const running = snap?.commands.find((c) => c.status.state === 'running')

  const label = { fontFamily: 'var(--font-pixel)', fontSize: 7, letterSpacing: 1 } as const
  const mono = { fontFamily: 'var(--font-mono)', fontSize: 10 } as const

  return (
    // the island unfurls from the hardware notch: scaleY from the top edge +
    // fade, pure CSS on a fixed-size window, so the motion is fluid
    <div
      onMouseLeave={() => setExpanded(false)}
      style={{
        height: '100vh',
        background: '#000',
        borderRadius: '0 0 18px 18px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: CREAM,
        opacity: expanded ? 1 : 0,
        transform: expanded ? 'scaleY(1)' : 'scaleY(0.24)',
        transformOrigin: 'top center',
        transition: expanded
          ? 'transform 300ms cubic-bezier(0.32, 1.3, 0.36, 1), opacity 170ms ease-out'
          : 'transform 220ms cubic-bezier(0.4, 0, 0.6, 1), opacity 160ms ease-in',
        pointerEvents: expanded ? 'auto' : 'none',
        willChange: 'transform, opacity'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 18px', height: NOTCH_H, flexShrink: 0 }}>
        {/* these hug the wings either side of the physical notch */}
        <span style={{ ...label, fontSize: 8, color: running ? CLAY : CREAM }}>
          {running ? `▶ ${running.info.label}` : 'vault'}
        </span>
        <span style={{ ...label, fontSize: 8, color: snap && snap.usage.percent > 80 ? CLAY : DIM }}>
          ◉ {snap?.usage.percent ?? 0}%
        </span>
      </div>

      {expanded && snap && (
        <div style={{ display: 'flex', gap: 12, padding: '6px 14px 12px', flex: 1, minHeight: 0 }}>
          <MiniMascot />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {TABS.map((t) => (
                <span
                  key={t}
                  onClick={() => setTab(t)}
                  style={{ ...label, cursor: 'pointer', color: t === tab ? CLAY : DIM, paddingBottom: 2, borderBottom: t === tab ? `1px solid ${CLAY}` : '1px solid transparent' }}
                >
                  {t}
                </span>
              ))}
            </div>

            {tab === 'STATUS' && (
              <div style={{ ...mono, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: DIM }}>CLAUDE 5H WINDOW</span>
                  <span style={{ color: snap.usage.percent > 80 ? CLAY : CREAM }}>
                    {snap.usage.percent}% · {Math.round(snap.usage.windowTokens / 1000)}K
                  </span>
                </div>
                <div style={{ height: 4, background: '#26251e', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${snap.usage.percent}%`, background: snap.usage.percent > 80 ? CLAY : CREAM, borderRadius: 2, transition: 'width 600ms cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
                <div style={{ color: DIM }}>
                  {running
                    ? <span><span style={{ color: CLAY }}>▶ running</span> {running.info.label.toLowerCase()}</span>
                    : `idle · ${snap.commands.filter((c) => c.status.state === 'done').length} done today`}
                </div>
              </div>
            )}

            {tab === 'PLAN' && (
              <div style={{ ...mono, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: DIM }}>{snap.primary.label}</span>
                  <span>{snap.primary.value.toLocaleString()} / {snap.primary.target.toLocaleString()}</span>
                </div>
                {snap.directives.filter((d) => !d.done).slice(0, 2).map((d) => (
                  <div key={`${d.file}:${d.line}`} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: CLAY }}>□ </span>{d.text}
                  </div>
                ))}
                {snap.directives.length === 0 && <span style={{ color: DIM }}>no plan yet — run PLAN TODAY</span>}
                {snap.directives.length > 0 && (
                  <span style={{ color: DIM }}>{snap.directives.filter((d) => d.done).length}/{snap.directives.length} done</span>
                )}
              </div>
            )}

            {tab === 'GIT' && (
              <div style={{ ...mono, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...snap.repos].sort((a, b) => b.commitsWeek - a.commitsWeek).slice(0, 3).map((r) => (
                  <div key={r.path} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                    <span style={{ color: DIM, flexShrink: 0 }}>
                      {r.commitsWeek}/wk{r.dirtyFiles > 0 ? <span style={{ color: CLAY }}> · {r.dirtyFiles}✎</span> : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tab === 'RUN' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {snap.commands.slice(0, 4).map(({ info, status }) => (
                  <button
                    key={info.id}
                    onClick={() => window.vault.runCommand(info.id)}
                    disabled={status.state === 'running' || status.state === 'queued'}
                    style={{ fontSize: 8, padding: '5px 6px', boxShadow: 'none', background: '#000', color: status.state === 'running' ? CLAY : CREAM, border: `1px solid ${EDGE}`, borderRadius: 4 }}
                  >
                    {status.state === 'running' ? '▶ ' : status.state === 'failed' ? '✕ ' : '· '}
                    {info.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
