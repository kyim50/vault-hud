import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from 'react'
import { resolveGeometry, GEOMETRY_BOUNDS, type ResolvedGeometry } from '../lib/resolveGeometry'
import { resolveLayout } from '../lib/resolveLayout'
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
import { VaultfetchPanel, DEFAULT_FETCH_OPTIONS, type FetchOptions } from '../components/VaultfetchPanel'
import { lofi } from '../lib/audio'
import type { HudModule, RenderContext } from '../modules/types'
import { resolveModule } from '../modules/resolve'
import { BUILTINS } from '../theme/builtins'
import { resolve } from '../theme/resolve'
import { applyTheme } from '../theme/apply'
import { setSceneColors } from '../theme/sceneColors'

// any module can live in any zone, in any order — drag a panel's ⠿ grip to
// move it between zones; the placement persists in config.ui.layout.zones,
// and each module's enabled/options come from config.ui.modules[id] (see resolveModule)
const MODULES: Record<string, HudModule<any>> = {
  fetch: { id: 'fetch', defaults: DEFAULT_FETCH_OPTIONS, render: (s, o: FetchOptions) => <VaultfetchPanel snap={s} opts={o} /> },
  vitals: { id: 'vitals', defaults: {}, render: (s) => <VitalsPanel repos={s.repos} usage={s.usage} audio={s.ui.audio} /> },
  directives: { id: 'directives', defaults: {}, render: (s) => <DirectivesPanel directives={s.directives} /> },
  brain: { id: 'brain', defaults: {}, render: (s) => <SecondBrainPanel recent={s.brain.recent} resurfaced={s.brain.resurfaced} /> },
  deck: { id: 'deck', defaults: {}, render: (s) => <CommandDeck commands={s.commands} /> },
  schedule: { id: 'schedule', defaults: {}, render: (s) => <SchedulePanel schedule={s.schedule} /> },
  skills: { id: 'skills', defaults: {}, render: (s) => <SkillsPanel skills={s.skills} /> },
  totem: { id: 'totem', defaults: {}, render: (s) => <TotemPanel sprite={s.sprites.find((sp) => sp.use === 'totem')} /> },
  core: {
    id: 'core',
    defaults: {},
    render: (s, _o: Record<string, never>, ctx: RenderContext) => (
      <Panel
        title="Core"
        corner={
          <span>
            {s.mood === 'napping' ? 'RESTING' : 'ALIVE'} ·{' '}
            <span
              onClick={() => ctx.setChart((c) => !c)}
              className={ctx.chart ? 'clay' : 'dim'}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title={ctx.chart ? 'back to the scene (esc)' : 'browse the wiki-link star chart'}
            >
              ✦ CHART
            </span>
          </span>
        }
        style={{ flex: 1, border: 'none', padding: '8px 0' }}
      >
        <CoreScene
          usagePercent={s.usage.percent}
          busy={s.commands.some((c) => c.status.state === 'running')}
          mood={s.mood}
          loot={s.loot}
          graph={s.graph}
          chart={ctx.chart}
          scenes={s.ui.scenes}
          maxWidth={ctx.coreMax}
        />
        <div style={{ borderTop: '1px dotted var(--line-soft)', paddingTop: 8 }}>
          <PrimaryDirective {...s.primary} />
        </div>
      </Panel>
    )
  }
}
const VALID_IDS = new Set(Object.keys(MODULES))
// these soak up leftover column height; the rest hug their content
const GROWS = new Set(['brain', 'skills', 'core'])

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
  const [localLayout, setLocalLayout] = useState<string[][] | null>(null)
  const [drag, setDrag] = useState<string | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [localGeometry, setLocalGeometry] = useState<ResolvedGeometry | null>(null)
  const draggingRef = useRef(false)
  const dragValueRef = useRef<ResolvedGeometry | null>(null)
  useLayoutEffect(() => {
    if (!snap) return
    try {
      const defs = { ...BUILTINS, ...snap.userThemes }
      const resolved = resolve(defs[snap.ui.theme] ?? BUILTINS.terminal)
      applyTheme(resolved)
      setSceneColors(resolved)
    } catch {
      // malformed user theme (e.g. a non-string color value) — never blank the HUD
      const fallback = resolve(BUILTINS.terminal)
      applyTheme(fallback)
      setSceneColors(fallback)
    }
  }, [snap?.ui.theme, snap?.userThemes])
  // ambient synth follows the persisted audio config
  useEffect(() => {
    if (snap) lofi.apply(snap.ui.audio)
  }, [snap?.ui.audio?.mode, snap?.ui.audio?.volume])
  // once a drag or a Settings change lands in the snapshot, the optimistic
  // local value yields to config (guarded so a mid-drag snapshot doesn't interrupt)
  useEffect(() => {
    if (!draggingRef.current) setLocalGeometry(null)
  }, [JSON.stringify(snap?.ui.geometry)])
  if (!snap) return <p style={{ padding: 16 }}>booting…</p>

  const zones = localLayout ?? resolveLayout(snap.ui.layout, VALID_IDS)
  const geo = localGeometry ?? resolveGeometry(snap.ui.geometry, zones.length)

  const startResize = (zoneIdx: number, e: ReactMouseEvent): void => {
    e.preventDefault()
    draggingRef.current = true
    const base = localGeometry ?? resolveGeometry(snap.ui.geometry, zones.length)
    const startX = e.clientX
    const startW = base.zoneWidths[zoneIdx]
    const [min, max] = GEOMETRY_BOUNDS.zoneWidth
    // zones left of the flex zone widen when dragged right; zones right of it widen when dragged left
    const dir = zoneIdx < base.flexZone ? 1 : -1
    const onMove = (ev: MouseEvent): void => {
      const w = Math.max(min, Math.min(max, startW + dir * (ev.clientX - startX)))
      const nextWidths = base.zoneWidths.slice()
      nextWidths[zoneIdx] = w
      const next = { ...base, zoneWidths: nextWidths }
      dragValueRef.current = next
      setLocalGeometry(next)
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('blur', onUp)
      draggingRef.current = false
      const v = dragValueRef.current
      if (v) window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, zoneWidths: v.zoneWidths } } })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('blur', onUp)
  }

  const move = (dragId: string, zoneIdx: number, before?: string): void => {
    const next = zones.map((z) => z.filter((id) => id !== dragId))
    const arr = next[zoneIdx] ?? next[0]
    const at = before ? arr.indexOf(before) : -1
    arr.splice(at < 0 ? arr.length : at, 0, dragId)
    setLocalLayout(next)
    window.vault.updateConfig({ ui: { layout: { zones: next } } })
  }

  // add/remove a zone, keeping zoneWidths + flexZone aligned with the new zone
  // indices; applied optimistically (local state) so the flex column doesn't
  // flash the wrong width for a frame before the config round-trip lands
  const applyZones = (next: string[][], widths: number[], flexZone: number): void => {
    setLocalLayout(next)
    setLocalGeometry({ zoneWidths: widths, flexZone, coreMax: geo.coreMax })
    window.vault.updateConfig({
      ui: { layout: { zones: next }, geometry: { ...snap.ui.geometry, zoneWidths: widths, flexZone } }
    })
  }

  const addZone = (side: 'start' | 'end'): void => {
    if (side === 'start') {
      // prepend: new zone takes index 0, every existing zone (and the flex one) shifts right by 1
      applyZones([[], ...zones], [260, ...geo.zoneWidths], geo.flexZone + 1)
    } else {
      // append: existing indices unchanged, new zone's width goes on the end
      applyZones([...zones, []], [...geo.zoneWidths, 260], geo.flexZone)
    }
  }

  const removeZone = (zoneIdx: number): void => {
    if (zones.length <= 1) return // never remove the last zone
    const next = zones.filter((_, i) => i !== zoneIdx)
    const widths = geo.zoneWidths.filter((_, i) => i !== zoneIdx)
    // keep the flex zone pointing at the same logical column after the splice
    const flexZone = Math.max(0, Math.min(next.length - 1, zoneIdx < geo.flexZone ? geo.flexZone - 1 : geo.flexZone))
    applyZones(next, widths, flexZone)
  }

  const renderZone = (zoneIdx: number): ReactNode => {
    const isFlex = zoneIdx === geo.flexZone
    const handleSide = zoneIdx < geo.flexZone ? 'right' : 'left'
    return (
      <div style={{ position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          onDragOver={(e) => {
            if (drag) {
              e.preventDefault()
              setOver(`zone:${zoneIdx}`)
            }
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            e.preventDefault()
            if (drag) move(drag, zoneIdx)
            setOver(null)
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 0,
            flex: 1,
            overflowY: 'auto',
            outline: over === `zone:${zoneIdx}` ? '1px dashed var(--clay)' : 'none',
            outlineOffset: 2
          }}
        >
          {zones[zoneIdx].map((id) => {
            const mod = MODULES[id]
            if (!mod) return null
            const { enabled, options } = resolveModule(mod.defaults, snap.ui.modules?.[id])
            if (!enabled) return null
            return (
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
                  if (drag && drag !== id) move(drag, zoneIdx, id)
                  setOver(null)
                }}
                style={{
                  // GROWS panels (e.g. Second Brain) soak up leftover height instead of
                  // being crushed when the window shrinks — the zone scrolls instead
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
                {mod.render(snap, options, { chart, setChart, coreMax: geo.coreMax })}
              </div>
            )
          })}
          {zones[zoneIdx].length === 0 && (
            <div
              className="dim"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: '1px dashed var(--line-soft)',
                fontSize: 10
              }}
            >
              <span>drop a panel here</span>
              {zones.length > 1 && (
                <button onClick={() => removeZone(zoneIdx)} style={{ fontSize: 10 }} title="remove this zone">
                  ✕ remove zone
                </button>
              )}
            </div>
          )}
        </div>
        {!isFlex && (
          <div
            className="resize-handle"
            title="drag to resize"
            onMouseDown={(e) => startResize(zoneIdx, e)}
            style={{ position: 'absolute', top: 0, bottom: 0, width: 8, [handleSide]: -8, cursor: 'col-resize', zIndex: 5 }}
          />
        )}
      </div>
    )
  }

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
        gridTemplateColumns: geo.zoneWidths.map((w, i) => (i === geo.flexZone ? '1fr' : `${w}px`)).join(' '),
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
          <button onClick={() => addZone('end')} style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, padding: '5px 8px', letterSpacing: 1 }} title="add a zone">
            + ZONE
          </button>
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
      <div style={{ display: 'contents' }}>
        {zones.map((_, i) => (
          <Fragment key={i}>{renderZone(i)}</Fragment>
        ))}
      </div>
    </div>
    {settingsOpen && <SettingsPanel snap={snap} onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
