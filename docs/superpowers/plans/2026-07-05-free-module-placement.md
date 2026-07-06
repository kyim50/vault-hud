# Free Module Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the fixed *left column · hardcoded Core center · right column* layout into an arbitrary number of zones where every panel — the Core included — is a draggable module placeable in any zone, in any order.

**Architecture:** A new pure `resolveLayout()` turns the config's `ui.layout` into a clean `string[][]` (zones), migrating legacy `{left,right}` and failing soft. `resolveGeometry()` generalizes from `leftWidth/rightWidth` to per-zone `zoneWidths[]` + a `flexZone` index. The Core joins the `MODULES` registry via a widened `render` signature that receives a small `RenderContext`. `App.tsx` replaces its three hardcoded regions with a zone-array render loop; `move`/`startResize`/`over` become zone-index-keyed.

**Tech Stack:** TypeScript, React, Electron, Vitest. Renderer at `src/renderer/src`, shared types at `src/shared`, tests at `tests/`.

## Global Constraints

- Branch: `vaultfetch` (stay on it — do NOT create a new branch or merge).
- No `Co-Authored-By` trailer on any commit.
- Fail-soft at the user-editable-JSON boundary: every field crossing from `~/.vault-hud/config.json` (`ui.layout`, `ui.geometry`) is validated in the resolvers; `App` trusts resolver output. Non-array zones, non-string ids, out-of-range `flexZone`, non-numeric widths, zero/all-empty zones → fall back, never crash the HUD.
- No-config behavior must stay byte-identical to today: 3 zones `[[fetch,vitals,directives,brain],[core],[deck,schedule,totem,skills]]`, grid `280px 1fr 300px`, `coreMax 560`. This parity is locked by unit tests.
- Config writes shallow-merge (`Object.assign(config.ui, patch.ui)`): every layout/geometry write MUST spread the current slice, e.g. `updateConfig({ ui: { geometry: { ...snap.ui.geometry, zoneWidths: next } } })`.
- Verification gates: `npm test` (Vitest), `npm run typecheck`, `npm run build`. Canvas/DOM behavior (drag, add/remove zone) is verified manually in `npm run dev` — note this in the task's verification, do not fabricate a passing automated check for it.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/renderer/src/lib/resolveLayout.ts` | **New.** Pure: config `ui.layout` → sanitized `string[][]`; legacy migration; `DEFAULT_ZONES`. |
| `src/renderer/src/lib/resolveGeometry.ts` | Generalized: per-zone `zoneWidths[]` + `flexZone`; legacy `leftWidth/rightWidth` migration; `coreMax` + `resolveCoreMax`. |
| `src/shared/types.ts` | `PanelLayout.zones`; `GeometryConfig.zoneWidths/flexZone`; legacy fields kept optional. |
| `src/renderer/src/modules/types.ts` | `RenderContext`; widened `HudModule.render` third arg. |
| `src/renderer/src/hud/App.tsx` | `core` module; zone-array render loop; `move`/`startResize`/`over` by zone index; grid from `zoneWidths`; `+`/`✕` zone affordances. |
| `src/renderer/src/components/SettingsPanel.tsx` | Trim SIZE steppers to `coreMax`-only (per-zone steppers deferred to G). |
| `tests/resolveLayout.test.ts` | **New.** Unit tests for `resolveLayout`. |
| `tests/resolveGeometry.test.ts` | Rewritten for the generalized shape. |

---

## Task 1: `resolveLayout` pure resolver + additive types

Purely additive — adds a new file and optional type fields, changes no existing call site. Tree stays green.

**Files:**
- Create: `src/renderer/src/lib/resolveLayout.ts`
- Modify: `src/shared/types.ts:36-39` (PanelLayout), `:60-64` (GeometryConfig)
- Test: `tests/resolveLayout.test.ts`

**Interfaces:**
- Produces: `resolveLayout(cfg: PanelLayout | undefined, validIds: Set<string>): string[][]` and `DEFAULT_ZONES: string[][]`.
- Consumes: `PanelLayout` from `@shared/types`.

- [ ] **Step 1: Extend the shared types (additive, optional)**

In `src/shared/types.ts`, replace the `PanelLayout` interface (lines 36-39):

```ts
export interface PanelLayout {
  zones?: string[][] // ordered zones, each an ordered list of module ids
  left?: string[] // legacy (pre-zones) — migrated to zones, then ignored
  right?: string[] // legacy
}
```

And replace `GeometryConfig` (lines 60-64):

```ts
export interface GeometryConfig {
  zoneWidths?: number[] // px per zone, index-aligned with layout.zones
  flexZone?: number // index of the zone that soaks leftover width (the `1fr`)
  coreMax?: number // px, Core canvas max width
  leftWidth?: number // legacy — migrated to zoneWidths
  rightWidth?: number // legacy
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/resolveLayout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveLayout, DEFAULT_ZONES } from '../src/renderer/src/lib/resolveLayout'

const VALID = new Set(['fetch', 'vitals', 'directives', 'brain', 'core', 'deck', 'schedule', 'totem', 'skills'])

describe('resolveLayout', () => {
  it('no config → DEFAULT_ZONES (parity with today)', () => {
    expect(resolveLayout(undefined, VALID)).toEqual([
      ['fetch', 'vitals', 'directives', 'brain'],
      ['core'],
      ['deck', 'schedule', 'totem', 'skills']
    ])
  })

  it('returns a fresh copy (never the DEFAULT_ZONES reference)', () => {
    expect(resolveLayout(undefined, VALID)).not.toBe(DEFAULT_ZONES)
  })

  it('migrates legacy {left,right} → [left, [core], right]', () => {
    expect(resolveLayout({ left: ['fetch', 'vitals'], right: ['deck'] }, VALID)).toEqual([
      ['fetch', 'vitals'],
      ['core'],
      ['deck']
    ])
  })

  it('passes an explicit zones array through, sanitized', () => {
    expect(resolveLayout({ zones: [['core', 'brain'], ['deck']] }, VALID)).toEqual([['core', 'brain'], ['deck']])
  })

  it('drops ids not in the registry', () => {
    expect(resolveLayout({ zones: [['core', 'bogus'], ['deck']] }, VALID)).toEqual([['core'], ['deck']])
  })

  it('dedupes an id appearing in multiple zones (first wins)', () => {
    expect(resolveLayout({ zones: [['core'], ['core', 'deck']] }, VALID)).toEqual([['core'], ['deck']])
  })

  it('keeps an empty zone as long as another zone has content (drop target persists)', () => {
    expect(resolveLayout({ zones: [['core'], []] }, VALID)).toEqual([['core'], []])
  })

  it('a user-removed module stays removed (not re-appended)', () => {
    // no `core` anywhere — must NOT be force-added back
    expect(resolveLayout({ zones: [['fetch'], ['deck']] }, VALID)).toEqual([['fetch'], ['deck']])
  })

  it('fail-soft: non-array zones → DEFAULT_ZONES', () => {
    expect(resolveLayout({ zones: 'core' as unknown as string[][] }, VALID)).toEqual(DEFAULT_ZONES)
  })

  it('fail-soft: empty array → DEFAULT_ZONES', () => {
    expect(resolveLayout({ zones: [] }, VALID)).toEqual(DEFAULT_ZONES)
  })

  it('fail-soft: all-empty zones → DEFAULT_ZONES (never a blank HUD)', () => {
    expect(resolveLayout({ zones: [[], []] }, VALID)).toEqual(DEFAULT_ZONES)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/resolveLayout.test.ts`
Expected: FAIL — `Cannot find module '../src/renderer/src/lib/resolveLayout'`.

- [ ] **Step 4: Write the implementation**

Create `src/renderer/src/lib/resolveLayout.ts`:

```ts
import type { PanelLayout } from '@shared/types'

// Canonical default layout — reproduces the pre-zones HUD exactly.
export const DEFAULT_ZONES: string[][] = [
  ['fetch', 'vitals', 'directives', 'brain'],
  ['core'],
  ['deck', 'schedule', 'totem', 'skills']
]

// config `ui.layout` → sanitized zones. Fail-soft at the user-JSON boundary:
// migrates legacy {left,right}, drops unknown/duplicate ids, and never returns
// zero or all-empty zones (that would blank the HUD).
export function resolveLayout(cfg: PanelLayout | undefined, validIds: Set<string>): string[][] {
  const seen = new Set<string>()
  const cleanZone = (arr: unknown): string[] =>
    (Array.isArray(arr) ? arr : []).filter(
      (id): id is string => typeof id === 'string' && validIds.has(id) && !seen.has(id) && !!seen.add(id)
    )

  let raw: unknown[]
  if (Array.isArray(cfg?.zones)) {
    raw = cfg!.zones
  } else if (Array.isArray(cfg?.left) || Array.isArray(cfg?.right)) {
    // legacy migration: two columns become [left, [core], right]
    raw = [cfg?.left ?? [], ['core'], cfg?.right ?? []]
  } else {
    return DEFAULT_ZONES.map((z) => [...z])
  }

  const zones = raw.map(cleanZone)
  if (zones.length === 0 || zones.every((z) => z.length === 0)) {
    return DEFAULT_ZONES.map((z) => [...z])
  }
  return zones
}
```

- [ ] **Step 5: Run tests + typecheck to verify green**

Run: `npx vitest run tests/resolveLayout.test.ts && npm run typecheck`
Expected: all `resolveLayout` tests PASS; typecheck clean (additive type changes break nothing).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/resolveLayout.ts src/shared/types.ts tests/resolveLayout.test.ts
git commit -m "feat: resolveLayout pure resolver + zones/geometry type fields"
```

---

## Task 2: Zone migration — generalize geometry, Core-as-module, zone render loop

The atomic migration. Generalizes `resolveGeometry`, adds `RenderContext` + the `core` module, and rewrites `App.tsx`'s three hardcoded regions into a zone-array loop. All callers move together so the tree is green at the end. Delivers the headline capability (any panel — Core included — draggable into any of the current zones, zone boundaries resizable). Add/remove-zone UI is Task 3.

**Files:**
- Modify: `src/renderer/src/lib/resolveGeometry.ts` (full rewrite), `src/renderer/src/modules/types.ts`, `src/renderer/src/hud/App.tsx`, `src/renderer/src/components/SettingsPanel.tsx:137-160`
- Test: `tests/resolveGeometry.test.ts` (rewrite)

**Interfaces:**
- Consumes: `resolveLayout`, `DEFAULT_ZONES` (Task 1); `PanelLayout`, `GeometryConfig` (Task 1 types).
- Produces: `resolveGeometry(cfg, zoneCount): ResolvedGeometry` where `ResolvedGeometry = { zoneWidths: number[]; flexZone: number; coreMax: number }`; `resolveCoreMax(cfg): number`; `GEOMETRY_BOUNDS = { zoneWidth: [180,460], coreMax: [360,1000] }`; `RenderContext = { chart: boolean; setChart: (fn:(c:boolean)=>boolean)=>void; coreMax: number }`.

- [ ] **Step 1: Rewrite the geometry resolver test**

Replace `tests/resolveGeometry.test.ts` entirely:

```ts
import { describe, it, expect } from 'vitest'
import { resolveGeometry, resolveCoreMax, GEOMETRY_BOUNDS } from '../src/renderer/src/lib/resolveGeometry'

describe('resolveGeometry', () => {
  it('no config, 3 zones → parity widths [280,260,300], flex=1, coreMax=560', () => {
    expect(resolveGeometry(undefined, 3)).toEqual({ zoneWidths: [280, 260, 300], flexZone: 1, coreMax: 560 })
  })

  it('produces exactly zoneCount widths, defaulting extras to 260', () => {
    const g = resolveGeometry(undefined, 5)
    expect(g.zoneWidths).toEqual([280, 260, 300, 260, 260])
  })

  it('clamps per-zone widths into [180,460]', () => {
    expect(resolveGeometry({ zoneWidths: [50, 9999, 300] }, 3).zoneWidths).toEqual([180, 460, 300])
  })

  it('migrates legacy leftWidth/rightWidth → [left, 260, right], flex=1', () => {
    const g = resolveGeometry({ leftWidth: 240, rightWidth: 320 }, 3)
    expect(g.zoneWidths).toEqual([240, 260, 320])
    expect(g.flexZone).toBe(1)
  })

  it('clamps flexZone into [0, zoneCount-1]', () => {
    expect(resolveGeometry({ flexZone: 9 }, 3).flexZone).toBe(2)
    expect(resolveGeometry({ flexZone: -4 }, 3).flexZone).toBe(0)
  })

  it('default flexZone with no legacy is the middle index', () => {
    expect(resolveGeometry({ zoneWidths: [200, 200, 200, 200] }, 4).flexZone).toBe(2)
  })

  it('fail-soft: non-numeric width → default; non-numeric flexZone → middle', () => {
    expect(resolveGeometry({ zoneWidths: ['x' as unknown as number, 200, 200] }, 3).zoneWidths[0]).toBe(280)
    expect(resolveGeometry({ flexZone: 'mid' as unknown as number }, 3).flexZone).toBe(1)
  })

  it('coreMax clamps and defaults; resolveCoreMax matches', () => {
    expect(resolveGeometry({ coreMax: 100 }, 3).coreMax).toBe(360)
    expect(resolveGeometry({ coreMax: 5000 }, 3).coreMax).toBe(1000)
    expect(resolveCoreMax({ coreMax: 700 })).toBe(700)
    expect(resolveCoreMax(undefined)).toBe(560)
  })

  it('zoneCount floors to at least 1', () => {
    expect(resolveGeometry(undefined, 0).zoneWidths).toEqual([280])
  })

  it('exports the bounds used by the UI', () => {
    expect(GEOMETRY_BOUNDS.zoneWidth).toEqual([180, 460])
    expect(GEOMETRY_BOUNDS.coreMax).toEqual([360, 1000])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/resolveGeometry.test.ts`
Expected: FAIL (old resolver returns `{leftWidth,...}`, no `resolveCoreMax`, no `GEOMETRY_BOUNDS.zoneWidth`).

- [ ] **Step 3: Rewrite the geometry resolver**

Replace `src/renderer/src/lib/resolveGeometry.ts` entirely:

```ts
import type { GeometryConfig } from '@shared/types'

export interface ResolvedGeometry {
  zoneWidths: number[] // length === zoneCount; the flex zone's entry is ignored for layout
  flexZone: number // index of the `1fr` zone
  coreMax: number
}

// clamp bounds — single source shared by the drag handlers and Settings
export const GEOMETRY_BOUNDS = {
  zoneWidth: [180, 460],
  coreMax: [360, 1000]
} as const

// per-index default widths: reproduce the pre-zones HUD (280 / flex / 300);
// any zone beyond the original three defaults to 260.
const DEFAULT_ZONE_WIDTHS = [280, 260, 300]
const defaultWidth = (i: number): number => DEFAULT_ZONE_WIDTHS[i] ?? 260

function clampNum(v: unknown, def: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def
}

export function resolveCoreMax(cfg: GeometryConfig | undefined): number {
  return clampNum(cfg?.coreMax, 560, GEOMETRY_BOUNDS.coreMax[0], GEOMETRY_BOUNDS.coreMax[1])
}

export function resolveGeometry(cfg: GeometryConfig | undefined, zoneCount: number): ResolvedGeometry {
  const count = Math.max(1, Math.floor(zoneCount) || 1)
  const legacy = typeof cfg?.leftWidth === 'number' || typeof cfg?.rightWidth === 'number'

  let raw: unknown[]
  if (Array.isArray(cfg?.zoneWidths)) raw = cfg!.zoneWidths
  else if (legacy) raw = [cfg?.leftWidth, defaultWidth(1), cfg?.rightWidth]
  else raw = []

  const [wmin, wmax] = GEOMETRY_BOUNDS.zoneWidth
  const zoneWidths = Array.from({ length: count }, (_, i) => clampNum(raw[i], defaultWidth(i), wmin, wmax))

  const rawFlex =
    typeof cfg?.flexZone === 'number' && Number.isFinite(cfg.flexZone)
      ? Math.floor(cfg.flexZone)
      : legacy
        ? 1
        : Math.floor(count / 2)
  const flexZone = Math.max(0, Math.min(count - 1, rawFlex))

  return { zoneWidths, flexZone, coreMax: resolveCoreMax(cfg) }
}
```

- [ ] **Step 4: Run the geometry test to verify it passes**

Run: `npx vitest run tests/resolveGeometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `RenderContext` to the module type**

Replace `src/renderer/src/modules/types.ts`:

```ts
import type { ReactNode } from 'react'
import type { HudSnapshot } from '@shared/types'

// Extra per-render state that a few modules (the Core) need but most ignore.
export interface RenderContext {
  chart: boolean
  setChart: (fn: (c: boolean) => boolean) => void
  coreMax: number
}

// A HUD module: a rendered unit (panel) with shipped option defaults.
// The registry + config.ui.modules make every module toggleable/configurable.
export interface HudModule<Opt = Record<string, never>> {
  id: string
  defaults: Opt
  render: (snap: HudSnapshot, opts: Opt, ctx: RenderContext) => ReactNode
}
```

- [ ] **Step 6: App.tsx — imports, the `core` module, and valid-id set**

In `src/renderer/src/hud/App.tsx`:

Update the geometry import (line 11) and add the layout import + `RenderContext`/`Panel`/`CoreScene`/`PrimaryDirective` are already imported — confirm and add what's missing:

```ts
import { resolveGeometry, resolveCoreMax, GEOMETRY_BOUNDS, type ResolvedGeometry } from '../lib/resolveGeometry'
import { resolveLayout } from '../lib/resolveLayout'
import type { RenderContext } from '../modules/types'
```

Add `core` to the `MODULES` record (after the `totem` entry, line 46). The Core keeps the exact JSX it has today in the center slot, now driven by `ctx`:

```ts
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
```

Replace the old `DEFAULT_LAYOUT` / `sanitizeLayout` block (lines 48-68) with a valid-id set and the grows set (add `core`):

```ts
const VALID_IDS = new Set(Object.keys(MODULES))
// these soak up leftover column height; the rest hug their content
const GROWS = new Set(['brain', 'skills', 'core'])
```

(Delete `DEFAULT_LAYOUT`, `sanitizeLayout`, and the `PanelLayout` import if now unused — keep the `PanelLayout` type import only if still referenced; `updateConfig({ ui: { layout } })` uses `{ zones }` now.)

- [ ] **Step 7: App.tsx — derive zones + geometry, generalize `move`/`startResize`/effects**

Replace the layout/geometry derivation and handlers (lines ~82-156). `localLayout` is now `string[][]`:

```ts
  const [localLayout, setLocalLayout] = useState<string[][] | null>(null)
  const [drag, setDrag] = useState<string | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [localGeometry, setLocalGeometry] = useState<ResolvedGeometry | null>(null)
  const draggingRef = useRef(false)
  const dragValueRef = useRef<ResolvedGeometry | null>(null)
```

Keep the theme/audio effects. Replace the geometry-clear effect dependency (line 110-112) so it reacts to the new slice:

```ts
  useEffect(() => {
    if (!draggingRef.current) setLocalGeometry(null)
  }, [JSON.stringify(snap?.ui.geometry)])
```

After the `if (!snap) return …` guard, derive zones then geometry (order matters — geometry needs the zone count):

```ts
  const zones = localLayout ?? resolveLayout(snap.ui.layout, VALID_IDS)
  const geo = localGeometry ?? resolveGeometry(snap.ui.geometry, zones.length)
```

Generalize `move` to a zone index:

```ts
  const move = (dragId: string, zoneIdx: number, before?: string): void => {
    const next = zones.map((z) => z.filter((id) => id !== dragId))
    const arr = next[zoneIdx] ?? next[0]
    const at = before ? arr.indexOf(before) : -1
    arr.splice(at < 0 ? arr.length : at, 0, dragId)
    setLocalLayout(next)
    window.vault.updateConfig({ ui: { layout: { zones: next } } })
  }
```

Generalize `startResize` to a zone index. Every non-flex zone has a handle on the edge facing the flex zone; dragging changes that zone's width, the flex zone absorbs the slack. `inward` (widening) is toward the flex zone:

```ts
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
```

- [ ] **Step 8: App.tsx — replace `renderColumn` with `renderZone(zoneIdx)`**

Replace `renderColumn` (lines 158-248) with a zone-index version. The panel-mapping JSX is preserved verbatim except `col`→`zoneIdx`, `over` keys become `zone:${zoneIdx}`, the resize handle only renders for non-flex zones and sits on the edge facing the flex zone, and `mod.render` receives the `RenderContext`:

```ts
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
```

- [ ] **Step 9: App.tsx — grid template + render the zones**

Replace the grid `gridTemplateColumns` (line 260) and the three region calls (`{renderColumn('left')}` … center div … `{renderColumn('right')}`, lines 310-344) with:

```ts
        gridTemplateColumns: geo.zoneWidths.map((w, i) => (i === geo.flexZone ? '1fr' : `${w}px`)).join(' '),
```

and, in place of the three hardcoded regions:

```ts
      {zones.map((_, i) => (
        <Fragment key={i}>{renderZone(i)}</Fragment>
      ))}
```

Add `Fragment` to the `react` import at the top of the file if not already present. The old center `<div>…<Panel title="Core">…</div>` block is deleted (the Core now renders through the `core` module inside whichever zone holds it).

- [ ] **Step 10: SettingsPanel.tsx — trim SIZE to coreMax-only**

In `src/renderer/src/components/SettingsPanel.tsx`, update the import (line 6) and the SIZE section (lines 137-160). Per-zone width steppers are deferred to G; keep only the Core-size stepper + reset:

```ts
import { resolveCoreMax, GEOMETRY_BOUNDS } from '../lib/resolveGeometry'
```

Replace the SIZE row body so it renders a single `core` stepper using `resolveCoreMax`:

```tsx
          <span style={{ ...label, width: 70 }}>SIZE</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(() => {
              const [min, max] = GEOMETRY_BOUNDS.coreMax
              const v = resolveCoreMax(snap.ui.geometry)
              const set = (n: number): void =>
                window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, coreMax: Math.max(min, Math.min(max, n)) } } })
              return (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => set(v - 20)} style={{ fontSize: 10 }}>−</button>
                  <span className="dim" style={{ fontSize: 10, minWidth: 64, textAlign: 'center' }}>core {v}px</span>
                  <button onClick={() => set(v + 20)} style={{ fontSize: 10 }}>+</button>
                </span>
              )
            })()}
            <button onClick={() => window.vault.updateConfig({ ui: { geometry: {} } })} style={{ fontSize: 10 }}>
              reset
            </button>
          </div>
```

(If the existing SIZE markup differs in wrapper structure, preserve the surrounding row `<div>`/label pattern and only swap the inner steppers. Read lines 137-160 first and match the existing style objects.)

- [ ] **Step 11: Full verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests PASS, typecheck clean, build exits 0.

- [ ] **Step 12: Manual smoke (canvas/DOM — cannot be automated)**

In `npm run dev`: confirm the no-config HUD is visually identical to before; drag the Core panel into a side zone and Second Brain into the center; drag a zone boundary to resize and confirm the flex zone absorbs; confirm an already-riced config (legacy `layout.left/right`, `geometry.leftWidth/rightWidth`) still loads and looks right. Report what was observed — do not claim automated coverage.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: zone-based layout — Core is a module, any panel in any zone"
```

---

## Task 3: Add / remove zones

Additive on Task 2. A `+` affordance in each gutter adds an empty zone; an empty zone shows a dashed placeholder with a `✕` to remove it. Minimum one zone. A reviewer can accept/reject this independently of Task 2's placement.

**Files:**
- Modify: `src/renderer/src/hud/App.tsx`

**Interfaces:**
- Consumes: `zones` (`string[][]`), `move`, `renderZone`, `geo` (Task 2).
- Produces: `addZone(side)`, `removeZone(zoneIdx)` local handlers.

- [ ] **Step 1: Add the zone add/remove handlers**

In `App.tsx`, after `move`, add:

```ts
  const writeLayout = (next: string[][]): void => {
    setLocalLayout(next)
    window.vault.updateConfig({ ui: { layout: { zones: next } } })
  }

  const addZone = (side: 'start' | 'end'): void => {
    const next = side === 'start' ? [[], ...zones] : [...zones, []]
    // adding a zone before the flex zone shifts it right by one — keep the same zone flexing
    if (side === 'start') {
      const g = localGeometry ?? geo
      window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, flexZone: g.flexZone + 1 } } })
    }
    writeLayout(next)
  }

  const removeZone = (zoneIdx: number): void => {
    if (zones.length <= 1) return // never remove the last zone
    const next = zones.filter((_, i) => i !== zoneIdx)
    const g = localGeometry ?? geo
    // keep the flex zone pointing at the same logical column after the splice
    const nextFlex = Math.max(0, Math.min(next.length - 1, zoneIdx < g.flexZone ? g.flexZone - 1 : g.flexZone))
    window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, flexZone: nextFlex } } })
    writeLayout(next)
  }
```

- [ ] **Step 2: Empty-zone placeholder + `✕` in `renderZone`**

In `renderZone`, inside the scrolling column `<div>` and after the `zones[zoneIdx].map(...)`, render a placeholder when the zone is empty:

```ts
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
```

- [ ] **Step 3: `+` gutter affordances**

In the return grid, wrap the zones map so an add-zone control sits at each end. Replace the `{zones.map(...)}` block from Task 2 with:

```ts
      <div style={{ display: 'contents' }}>
        {zones.map((_, i) => (
          <Fragment key={i}>{renderZone(i)}</Fragment>
        ))}
      </div>
```

and add a thin add-zone button as a fixed-position affordance in the header actions (keeps the grid template clean — no extra column). In the header's actions `<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>` (before the `⚙ SETTINGS` button), add:

```tsx
          <button onClick={() => addZone('end')} style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, padding: '5px 8px', letterSpacing: 1 }} title="add a zone">
            + ZONE
          </button>
```

(A single `+ ZONE` in the header appends a zone at the end — the simplest discoverable control. Prepending/`start` is available via `addZone('start')` but not wired to its own button in v1; the header button covers the core need. G will add the full zone manager.)

- [ ] **Step 4: Verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all PASS / clean / exit 0.

- [ ] **Step 5: Manual smoke (canvas/DOM)**

In `npm run dev`: click `+ ZONE` → an empty dashed zone appears; drag a panel into it; empty a zone by dragging its panels out → the `✕ remove zone` placeholder appears; remove it; confirm the flex column stays correct after add/remove; confirm you cannot remove the last remaining zone. Report observations.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add/remove layout zones"
```

---

## Self-Review

- **Spec coverage:** Core-as-module (T2 §6, RenderContext T2 §5) ✓; zones array + migration (T1) ✓; per-zone width + flexZone + legacy migration (T2 §3) ✓; drag any panel to any zone (T2 §7-8) ✓; zone-width handles (T2 §7-8) ✓; add/remove zones (T3) ✓; parity locked (T1 no-config test, T2 geometry parity test) ✓; fail-soft (T1 + T2 resolver tests) ✓; Settings deferred to G except coreMax trim (T2 §10) ✓; notch/intra-panel deferred to E ✓.
- **Placeholders:** none — every code step shows complete code; manual-smoke steps are explicitly flagged as un-automatable rather than faked.
- **Type consistency:** `resolveLayout(cfg, validIds): string[][]`, `resolveGeometry(cfg, zoneCount): {zoneWidths, flexZone, coreMax}`, `resolveCoreMax(cfg): number`, `RenderContext {chart, setChart, coreMax}`, `GEOMETRY_BOUNDS.zoneWidth` — used consistently across T1→T3. `move(id, zoneIdx, before?)` and `startResize(zoneIdx, e)` signatures match their call sites.
- **Ordering:** T1 additive (green); T2 atomic signature migration (green at end); T3 additive (green). Each ends testable.
