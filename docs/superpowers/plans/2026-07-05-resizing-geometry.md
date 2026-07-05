# Resizing / Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users drag the HUD's column dividers to resize the side columns (and thereby the Core), plus set sizes via Settings steppers — all persisted to `config.ui.geometry`.

**Architecture:** A pure `resolveGeometry()` turns the config slice into clamped, fail-soft widths (unit-tested). `App.tsx` renders the grid from the resolved geometry, adds a resize handle to each side column's inner edge, and drives a live optimistic `localGeometry` state during drag (mirroring the existing `localLayout` pattern), persisting once on mouse-release. The Core's max width becomes a prop fed from `geometry.coreMax`.

**Tech Stack:** TypeScript, React 19, Electron, Vitest (`environment: 'node'` — the pure resolver is unit-tested; App/CoreScene/Settings changes are verified via typecheck + build).

## Global Constraints

- **No Claude co-author trailer in any commit.** End commit messages at their own body.
- **Branch:** all work stays on the existing `vaultfetch` branch. Do not merge, do not create branches.
- **Test env is `node`:** only the pure `resolveGeometry` gets unit tests. App/CoreScene/Settings are verified with `npm run typecheck` + `npm run build` (do not add jsdom).
- **Behavior with no config must be identical to today:** grid `280px 1fr 300px`, Core `maxWidth 560`.
- **Clamp bounds (single source `GEOMETRY_BOUNDS`):** `leftWidth`/`rightWidth` → `[180, 460]`; `coreMax` → `[360, 1000]`. Defaults: 280 / 300 / 560.
- **Fail-soft:** a non-finite/non-number config value falls back to its default (runtime trust boundary, like `resolveScenes`).
- **Shallow-merge caveat:** every geometry `updateConfig` write spreads `{ ...snap.ui.geometry, … }` (because `updateConfig` does `Object.assign(config.ui, patch.ui)`).
- **Persist on release, not per-move:** live feedback via `localGeometry`; one config write per drag.
- **Do NOT launch the Electron GUI** in a subagent — the controller does visual verification.
- Verify `npm test` + `npm run typecheck` (+ `npm run build` where noted) green before each commit.

---

## File Structure

**Create:**
- `src/renderer/src/lib/resolveGeometry.ts` — pure resolver + `GEOMETRY_BOUNDS`
- `tests/resolveGeometry.test.ts`

**Modify:**
- `src/shared/types.ts` — add `GeometryConfig`; add `UiConfig.geometry?`
- `src/renderer/src/components/CoreScene.tsx` — `maxWidth: 560` → a `maxWidth?: number` prop
- `src/renderer/src/hud/App.tsx` — grid from resolved geometry; `localGeometry` + drag handles; pass `maxWidth`
- `src/renderer/src/styles/theme.css` — a `.resize-handle` hover rule
- `src/renderer/src/components/SettingsPanel.tsx` — SIZE steppers + reset

---

## Task 1: `resolveGeometry` pure resolver + config type

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/renderer/src/lib/resolveGeometry.ts`
- Test: `tests/resolveGeometry.test.ts`

**Interfaces:**
- Produces:
  - (shared) `GeometryConfig = { leftWidth?: number; rightWidth?: number; coreMax?: number }`; `UiConfig.geometry?: GeometryConfig`
  - (resolveGeometry) `ResolvedGeometry = { leftWidth: number; rightWidth: number; coreMax: number }`; `GEOMETRY_BOUNDS = { leftWidth: [180,460], rightWidth: [180,460], coreMax: [360,1000] }`; `resolveGeometry(cfg: GeometryConfig | undefined): ResolvedGeometry`

- [ ] **Step 1: Add shared types**

In `src/shared/types.ts`, add near `SceneConfig`:

```ts
export interface GeometryConfig {
  leftWidth?: number // px, left panel column
  rightWidth?: number // px, right panel column
  coreMax?: number // px, Core canvas max width
}
```

Add `geometry` to `UiConfig`:

```ts
export interface UiConfig {
  theme: string
  parade: boolean
  layout?: PanelLayout
  audio?: AudioConfig
  modules?: Record<string, ModuleConfig>
  themes?: Record<string, ThemeDef>
  scenes?: SceneConfig
  geometry?: GeometryConfig
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/resolveGeometry.test.ts
import { describe, it, expect } from 'vitest'
import { resolveGeometry, GEOMETRY_BOUNDS } from '../src/renderer/src/lib/resolveGeometry'

describe('resolveGeometry', () => {
  it('no config → defaults 280/300/560', () => {
    expect(resolveGeometry(undefined)).toEqual({ leftWidth: 280, rightWidth: 300, coreMax: 560 })
  })
  it('clamps below and above bounds', () => {
    expect(resolveGeometry({ leftWidth: 50 }).leftWidth).toBe(180)
    expect(resolveGeometry({ rightWidth: 9999 }).rightWidth).toBe(460)
    expect(resolveGeometry({ coreMax: 100 }).coreMax).toBe(360)
    expect(resolveGeometry({ coreMax: 5000 }).coreMax).toBe(1000)
  })
  it('passes in-range values through', () => {
    expect(resolveGeometry({ leftWidth: 350, rightWidth: 220, coreMax: 700 })).toEqual({ leftWidth: 350, rightWidth: 220, coreMax: 700 })
  })
  it('fail-soft: non-number / NaN falls back to default, per field', () => {
    expect(resolveGeometry({ leftWidth: '300px' as unknown as number }).leftWidth).toBe(280)
    expect(resolveGeometry({ rightWidth: NaN }).rightWidth).toBe(300)
    expect(resolveGeometry({ leftWidth: 200, coreMax: 'big' as unknown as number })).toEqual({ leftWidth: 200, rightWidth: 300, coreMax: 560 })
  })
  it('exports the bounds used by the UI', () => {
    expect(GEOMETRY_BOUNDS.leftWidth).toEqual([180, 460])
    expect(GEOMETRY_BOUNDS.coreMax).toEqual([360, 1000])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/resolveGeometry.test.ts`
Expected: FAIL — cannot find module `resolveGeometry`.

- [ ] **Step 4: Write `resolveGeometry.ts`**

```ts
// src/renderer/src/lib/resolveGeometry.ts
import type { GeometryConfig } from '@shared/types'

export interface ResolvedGeometry {
  leftWidth: number
  rightWidth: number
  coreMax: number
}

// clamp bounds — single source shared by the drag handlers and Settings steppers
export const GEOMETRY_BOUNDS = {
  leftWidth: [180, 460],
  rightWidth: [180, 460],
  coreMax: [360, 1000]
} as const

// finite number → clamped to [min,max]; anything else → default (fail-soft at the
// user-editable-JSON boundary, same lesson as resolveScenes)
function clampNum(v: unknown, def: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def
}

export function resolveGeometry(cfg: GeometryConfig | undefined): ResolvedGeometry {
  return {
    leftWidth: clampNum(cfg?.leftWidth, 280, GEOMETRY_BOUNDS.leftWidth[0], GEOMETRY_BOUNDS.leftWidth[1]),
    rightWidth: clampNum(cfg?.rightWidth, 300, GEOMETRY_BOUNDS.rightWidth[0], GEOMETRY_BOUNDS.rightWidth[1]),
    coreMax: clampNum(cfg?.coreMax, 560, GEOMETRY_BOUNDS.coreMax[0], GEOMETRY_BOUNDS.coreMax[1])
  }
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run tests/resolveGeometry.test.ts && npm run typecheck`
Expected: 5 tests PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/renderer/src/lib/resolveGeometry.ts tests/resolveGeometry.test.ts
git commit -m "feat: GeometryConfig type + resolveGeometry pure resolver"
```

---

## Task 2: CoreScene maxWidth prop + App drag-resize + live geometry

**Files:**
- Modify: `src/renderer/src/components/CoreScene.tsx`
- Modify: `src/renderer/src/hud/App.tsx`
- Modify: `src/renderer/src/styles/theme.css`

**Interfaces:**
- Consumes: `resolveGeometry`, `GEOMETRY_BOUNDS`, `ResolvedGeometry` from `../lib/resolveGeometry`; `GeometryConfig` from `@shared/types`
- Produces: `CoreScene` gains `maxWidth?: number` (default 560)

*(Manual verification — layout + drag. Gates: typecheck + build. No unit test.)*

- [ ] **Step 1: CoreScene — make the canvas max width a prop**

In `src/renderer/src/components/CoreScene.tsx`, add `maxWidth` to the props destructure and type (default 560):

```ts
export function CoreScene({
  usagePercent,
  busy,
  mood,
  loot,
  graph,
  chart,
  scenes,
  maxWidth = 560
}: {
  usagePercent: number
  busy: boolean
  mood: Mood
  loot: string[]
  graph: LinkGraph
  chart: boolean
  scenes?: SceneConfig
  maxWidth?: number
}) {
```

Change the canvas style (line ~1131) from `maxWidth: 560` to `maxWidth`:

```tsx
        style={{ width: '100%', maxWidth, imageRendering: 'pixelated', aspectRatio: '16/9' }}
```

- [ ] **Step 2: App — add imports + geometry state**

In `src/renderer/src/hud/App.tsx`, add imports:

```ts
import { resolveGeometry, GEOMETRY_BOUNDS, type ResolvedGeometry } from '../lib/resolveGeometry'
```

The current React import is `import { useEffect, useLayoutEffect, useState, type DragEvent, type ReactNode } from 'react'`. Extend it to add `useRef` (used for the drag refs) and a React-MouseEvent alias (the file uses named type imports, so `React.MouseEvent` is NOT available):

```ts
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
```

`GeometryConfig` is not needed as a named import — `snap.ui.geometry` is already typed via the snapshot. (If you reference the type explicitly, add it to the existing `@shared/types` import line.)

Near the other state hooks (after `const [over, setOver] = useState<string | null>(null)`), add the live-drag state + refs:

```ts
  const [localGeometry, setLocalGeometry] = useState<ResolvedGeometry | null>(null)
  const draggingRef = useRef(false)
  const dragValueRef = useRef<ResolvedGeometry | null>(null)
```

- [ ] **Step 3: App — clear local geometry when the persisted config changes**

Add an effect (near the other `useEffect`s) so that once a drag or a Settings change lands in the snapshot, the optimistic local value yields to config. The primitive deps stay stable (no re-fire on unrelated snapshots), and the `draggingRef` guard prevents a mid-drag snapshot from interrupting:

```ts
  useEffect(() => {
    if (!draggingRef.current) setLocalGeometry(null)
  }, [snap?.ui.geometry?.leftWidth, snap?.ui.geometry?.rightWidth, snap?.ui.geometry?.coreMax])
```

- [ ] **Step 4: App — the resize drag handler**

After `const layout = localLayout ?? sanitizeLayout(snap.ui.layout)` (inside the component, where `snap` is known non-null), add the effective geometry + the drag starter:

```ts
  const geo = localGeometry ?? resolveGeometry(snap.ui.geometry)

  const startResize = (side: 'left' | 'right', e: ReactMouseEvent): void => {
    e.preventDefault()
    draggingRef.current = true
    const base = localGeometry ?? resolveGeometry(snap.ui.geometry)
    const startX = e.clientX
    const startW = side === 'left' ? base.leftWidth : base.rightWidth
    const [min, max] = side === 'left' ? GEOMETRY_BOUNDS.leftWidth : GEOMETRY_BOUNDS.rightWidth
    const onMove = (ev: MouseEvent): void => {
      const delta = ev.clientX - startX
      const raw = side === 'left' ? startW + delta : startW - delta // drag inward widens the column
      const w = Math.max(min, Math.min(max, raw))
      const next: ResolvedGeometry = { ...base, [side === 'left' ? 'leftWidth' : 'rightWidth']: w }
      dragValueRef.current = next
      setLocalGeometry(next)
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      draggingRef.current = false
      const v = dragValueRef.current
      if (v) window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, leftWidth: v.leftWidth, rightWidth: v.rightWidth } } })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
```

(`ReactMouseEvent` is the React synthetic-event type added to the `react` import in Step 2; `ev: MouseEvent` inside `onMove` is the global DOM event from the `window` listener — the two do not collide because the React one is aliased.)

- [ ] **Step 5: App — wrap each column with a resize handle**

Change `renderColumn` so its returned node is a `position: relative` wrapper containing the existing scrolling column plus a resize handle on the column's inner edge. Replace the outer `<div … style={{ display:'flex', flexDirection:'column', gap:8, minHeight:0, overflowY:'auto', … }}>` opening so the scroll div is wrapped:

```tsx
  const renderColumn = (col: 'left' | 'right'): ReactNode => (
    <div style={{ position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
          flex: 1,
          overflowY: 'auto',
          outline: over === `col:${col}` ? '1px dashed var(--clay)' : 'none',
          outlineOffset: 2
        }}
      >
        {layout[col].map((id) => {
          /* … existing panel-mapping body, UNCHANGED … */
        })}
      </div>
      <div
        className="resize-handle"
        title="drag to resize"
        onMouseDown={(e) => startResize(col, e)}
        style={{ position: 'absolute', top: 0, bottom: 0, width: 8, [col === 'left' ? 'right' : 'left']: -8, cursor: 'col-resize', zIndex: 5 }}
      />
    </div>
  )
```

Keep the existing panel-mapping JSX (the `{layout[col].map((id) => { … })}` block) exactly as-is inside the inner scrolling div — only the wrapper + handle are new.

- [ ] **Step 6: App — drive the grid + Core from resolved geometry**

Change the grid container's `gridTemplateColumns` (line ~189) from the hardcoded string to the resolved widths:

```tsx
        gridTemplateColumns: `${geo.leftWidth}px 1fr ${geo.rightWidth}px`,
```

Pass the Core max width to `<CoreScene>` (around line 273):

```tsx
          <CoreScene
            usagePercent={snap.usage.percent}
            busy={snap.commands.some((c) => c.status.state === 'running')}
            mood={snap.mood}
            loot={snap.loot}
            graph={snap.graph}
            chart={chart}
            scenes={snap.ui.scenes}
            maxWidth={geo.coreMax}
          />
```

- [ ] **Step 7: theme.css — resize-handle hover affordance**

In `src/renderer/src/styles/theme.css`, add:

```css
.resize-handle {
  background: transparent;
  transition: background 120ms;
}
.resize-handle:hover {
  background: linear-gradient(to right, transparent 3px, var(--clay) 3px, var(--clay) 4px, transparent 4px);
}
```

- [ ] **Step 8: Verify — typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: passes, build exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/components/CoreScene.tsx src/renderer/src/hud/App.tsx src/renderer/src/styles/theme.css
git commit -m "feat: drag-resizable columns + config-driven Core max width"
```

---

## Task 3: Settings — SIZE steppers + reset

**Files:**
- Modify: `src/renderer/src/components/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `resolveGeometry`, `GEOMETRY_BOUNDS` from `../lib/resolveGeometry`; `snap.ui.geometry`; `window.vault.updateConfig`; the existing `row`/`label` styles

*(Manual verification. Gate: typecheck + build.)*

- [ ] **Step 1: Add the import**

At the top of `SettingsPanel.tsx`:

```ts
import { resolveGeometry, GEOMETRY_BOUNDS } from '../lib/resolveGeometry'
```

- [ ] **Step 2: Add the SIZE section**

Insert after the existing `SPEED` (scenes) block a size section with a stepper per dimension + a reset. Every write spreads `snap.ui.geometry` (shallow-merge caveat); each stepper clamps with `GEOMETRY_BOUNDS`:

```tsx
        <div style={row}>
          <span style={{ ...label, width: 70 }}>SIZE</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([
              ['leftWidth', 'left'],
              ['rightWidth', 'right'],
              ['coreMax', 'core']
            ] as const).map(([field, name]) => {
              const g = resolveGeometry(snap.ui.geometry)
              const [min, max] = GEOMETRY_BOUNDS[field]
              const set = (v: number): void =>
                window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, [field]: Math.max(min, Math.min(max, v)) } } })
              return (
                <span key={field} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => set(g[field] - 20)} style={{ fontSize: 10 }}>−</button>
                  <span className="dim" style={{ fontSize: 10, width: 88 }}>{name} {g[field]}px</span>
                  <button onClick={() => set(g[field] + 20)} style={{ fontSize: 10 }}>+</button>
                </span>
              )
            })}
            <button onClick={() => window.vault.updateConfig({ ui: { geometry: {} } })} style={{ fontSize: 10 }}>
              ○ reset to defaults
            </button>
          </div>
        </div>
```

- [ ] **Step 3: Verify — typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: passes, build exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/SettingsPanel.tsx
git commit -m "feat: Settings SIZE steppers + reset for geometry"
```

---

## Final verification

- [ ] `npm test` — all suites pass (resolveGeometry + existing 137).
- [ ] `npm run typecheck` — zero errors.
- [ ] `npm run build` — exits 0.
- [ ] `git log --oneline` shows 3 new commits, none with a `Co-Authored-By` trailer (`git log <base>..HEAD --format='%b' | grep -i co-author` returns nothing).
- [ ] Manual (`npm run dev`): drag the left divider → left column resizes live, Core widens/narrows; release → persists across reload; drag the right divider likewise; Settings SIZE steppers adjust each dimension and reset restores 280/300/560; dragging past a clamp bound stops cleanly (no zero-width column, no runaway).

## Self-review notes (addressed)

- **Spec coverage:** `ui.geometry` + resolver with clamps/fail-soft/bounds (T1); grid from resolved geometry + drag handles + live `localGeometry` + persist-on-release + Core `maxWidth` prop (T2); Settings steppers + reset (T3). All covered.
- **No-config parity:** `resolveGeometry(undefined)` = `{280,300,560}` and `CoreScene` default `maxWidth = 560` → identical to today; T1 test locks it.
- **Type consistency:** `GeometryConfig` (shared, partial) vs `ResolvedGeometry` (resolver, filled); `GEOMETRY_BOUNDS` single-sourced in `resolveGeometry.ts` and imported by App (drag clamp) and Settings (stepper clamp).
- **Merge + timing caveats:** Settings and drag writes both spread `snap.ui.geometry`; drag persists once on release; `localGeometry` cleared by the primitive-keyed effect (guarded by `draggingRef`) when config changes.
