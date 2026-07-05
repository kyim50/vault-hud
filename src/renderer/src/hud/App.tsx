import { useEffect, useState, type DragEvent, type ReactNode } from 'react'
import type { HudSnapshot, PanelLayout } from '@shared/types'
import { useSnapshot } from '../lib/useSnapshot'
import { Panel } from '../components/Panel'
import { VitalsPanel } from '../components/VitalsPanel'
import { CommandDeck } from '../components/CommandDeck'
import { DirectivesPanel } from '../components/DirectivesPanel'
import { SecondBrainPanel } from '../components/SecondBrainPanel'
import { SchedulePanel } from '../components/SchedulePanel'
import { PrimaryDirective } from '../components/PrimaryDirective'
import { Clock } from '../components/Clock'
import { CoreScene } from '../components/CoreScene'
import { HudFrame } from '../components/HudFrame'
import { SkillsPanel } from '../components/SkillsPanel'
import { TotemPanel } from '../components/TotemPanel'
import { SettingsPanel } from '../components/SettingsPanel'
import { lofi } from '../lib/audio'

// the two side columns render these panels in user-chosen order (drag the
// ⠿ grip); the order persists in config as ui.layout
const PANELS: Record<string, (s: HudSnapshot) => ReactNode> = {
  vitals: (s) => <VitalsPanel repos={s.repos} usage={s.usage} audio={s.ui.audio} />,
  directives: (s) => <DirectivesPanel directives={s.directives} />,
  brain: (s) => <SecondBrainPanel recent={s.brain.recent} resurfaced={s.brain.resurfaced} />,
  deck: (s) => <CommandDeck commands={s.commands} />,
  schedule: (s) => <SchedulePanel schedule={s.schedule} />,
  skills: (s) => <SkillsPanel skills={s.skills} />,
  totem: (s) => <TotemPanel sprite={s.sprites.find((sp) => sp.use === 'totem')} />
}
const DEFAULT_LAYOUT: PanelLayout = {
  left: ['vitals', 'directives', 'brain'],
  right: ['deck', 'schedule', 'totem', 'skills']
}
// these two soak up leftover column height; the rest hug their content
const GROWS = new Set(['brain', 'skills'])

// a stored layout may be stale (edited config, renamed panels): keep known
// ids once each, then append anything missing to its default column
function sanitizeLayout(l?: PanelLayout): PanelLayout {
  const seen = new Set<string>()
  const clean = (arr: unknown): string[] =>
    (Array.isArray(arr) ? arr : []).filter(
      (id): id is string => typeof id === 'string' && id in PANELS && !seen.has(id) && !!seen.add(id)
    )
  const left = clean(l?.left)
  const right = clean(l?.right)
  for (const id of DEFAULT_LAYOUT.left) if (!seen.has(id)) left.push(id)
  for (const id of DEFAULT_LAYOUT.right) if (!seen.has(id)) right.push(id)
  return { left, right }
}

export default function App() {
  const snap = useSnapshot()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // sticky star-chart mode for the Core canvas (Esc leaves)
  const [chart, setChart] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setChart(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // optimistic layout: a drop applies instantly, config catches up async
  const [localLayout, setLocalLayout] = useState<PanelLayout | null>(null)
  const [drag, setDrag] = useState<string | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  useEffect(() => {
    if (snap) document.body.dataset.theme = snap.ui.theme
  }, [snap?.ui.theme])
  // ambient synth follows the persisted audio config
  useEffect(() => {
    if (snap) lofi.apply(snap.ui.audio)
  }, [snap?.ui.audio?.mode, snap?.ui.audio?.volume])
  if (!snap) return <p style={{ padding: 16 }}>booting…</p>

  const layout = localLayout ?? sanitizeLayout(snap.ui.layout)

  const move = (dragId: string, col: 'left' | 'right', before?: string): void => {
    const left = layout.left.filter((id) => id !== dragId)
    const right = layout.right.filter((id) => id !== dragId)
    const arr = col === 'left' ? left : right
    const at = before ? arr.indexOf(before) : -1
    arr.splice(at < 0 ? arr.length : at, 0, dragId)
    const next = { left, right }
    setLocalLayout(next)
    window.vault.updateConfig({ ui: { layout: next } })
  }

  const renderColumn = (col: 'left' | 'right'): ReactNode => (
    <div
      onDragOver={(e) => {
        if (drag) {
          e.preventDefault()
          setOver(`col:${col}`)
        }
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        e.preventDefault()
        if (drag) move(drag, col)
        setOver(null)
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 0,
        overflowY: 'auto',
        outline: over === `col:${col}` ? '1px dashed var(--clay)' : 'none',
        outlineOffset: 2
      }}
    >
      {layout[col].map((id) => (
        <div
          key={id}
          className="arrange"
          draggable={armed === id}
          onDragStart={(e: DragEvent) => {
            e.dataTransfer.effectAllowed = 'move'
            setDrag(id)
          }}
          onDragEnd={() => {
            setDrag(null)
            setArmed(null)
            setOver(null)
          }}
          onDragOver={(e) => {
            if (drag && drag !== id) {
              e.preventDefault()
              e.stopPropagation()
              setOver(id)
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (drag && drag !== id) move(drag, col, id)
            setOver(null)
          }}
          style={{
            // never squish panels when the window shrinks — the column
            // scrolls instead (this was crushing Second Brain on resize)
            flex: GROWS.has(id) ? '1 0 auto' : '0 0 auto',
            display: 'flex',
            flexDirection: 'column',
            opacity: drag === id ? 0.35 : 1,
            outline: over === id ? '1px dashed var(--clay)' : 'none',
            outlineOffset: 1,
            transition: 'opacity 120ms ease'
          }}
        >
          <span
            className="grip"
            title="drag to rearrange"
            onMouseDown={() => setArmed(id)}
            onMouseUp={() => setArmed(null)}
          >
            ⠿
          </span>
          {PANELS[id](snap)}
        </div>
      ))}
    </div>
  )

  return (
    <>
    <HudFrame
      critters={snap.ui.parade}
      sprites={snap.sprites.filter((sp) => sp.use === 'frame')}
      theme={snap.ui.theme}
    />
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr 300px',
        gridTemplateRows: snap.configCreated ? '40px auto 1fr' : '40px 1fr',
        gap: 8,
        height: '100vh',
        padding: 26 // clear the pixel frame + its patrolling critters
      }}
    >
      <header style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dotted var(--line-soft)', paddingBottom: 4 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, color: 'var(--ink)' }}>{snap.appName}</div>
          <div className="dim" style={{ fontSize: 9 }}>voice-free unified logic terminal</div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setSettingsOpen(true)}
            style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, padding: '5px 8px', letterSpacing: 1 }}
          >
            ⚙ SETTINGS
          </button>
          <Clock />
        </div>
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
      {renderColumn('left')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <Panel
          title="Core"
          corner={
            <span>
              {snap.mood === 'napping' ? 'RESTING' : 'ALIVE'} ·{' '}
              <span
                onClick={() => setChart((c) => !c)}
                className={chart ? 'clay' : 'dim'}
                style={{ cursor: 'pointer', userSelect: 'none' }}
                title={chart ? 'back to the scene (esc)' : 'browse the wiki-link star chart'}
              >
                ✦ CHART
              </span>
            </span>
          }
          style={{ flex: 1, border: 'none', padding: '8px 0' }}
        >
          <CoreScene
            usagePercent={snap.usage.percent}
            busy={snap.commands.some((c) => c.status.state === 'running')}
            mood={snap.mood}
            loot={snap.loot}
            graph={snap.graph}
            chart={chart}
          />
          <div style={{ borderTop: '1px dotted var(--line-soft)', paddingTop: 8 }}>
            <PrimaryDirective {...snap.primary} />
          </div>
        </Panel>
      </div>
      {renderColumn('right')}
    </div>
    {settingsOpen && <SettingsPanel snap={snap} onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
