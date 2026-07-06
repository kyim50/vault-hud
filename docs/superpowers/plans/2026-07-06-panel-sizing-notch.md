# Per-Panel Sizing + Customizable Notch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users resize individual panels (height + grow, by drag or Settings) and customize the notch window (on/off, width, expanded height), closing the vault-hud customization arc.

**Architecture:** Two pure resolvers — `resolvePanelSize` (renderer lib, with a shared `DEFAULT_GROW` set that replaces App's hardcoded `GROWS`) and `resolveNotch` (in `src/shared` so the main process can import it). App applies panel size to the `.arrange` flex and adds a bottom-edge height drag handle; `main` reads notch config at startup, gates window creation on `enabled`, and live re-pins on config change. Settings (Layout tab) gets per-panel grow/height controls and a Notch section.

**Tech Stack:** TypeScript, React, Electron, Vitest. Renderer `src/renderer/src`, shared `src/shared`, main `src/main`, tests `tests/`.

## Global Constraints

- Branch: `vaultfetch` — stay on it, do NOT branch or merge (E is the last sub-project; the arc merges to `main` after it).
- No `Co-Authored-By` trailer on any commit.
- No-config behavior byte-identical to today: panel `grow` defaults to `DEFAULT_GROW` membership (`brain`, `skills`, `core`); notch defaults `enabled:true / width:440 / expandedHeight:140`. Parity locked by resolver tests.
- Every config write spreads the current slice (`{ ...snap.ui.modules, [id]: {...} }`, `{ ...snap.ui.notch, ... }`).
- Fail-soft at the user-JSON boundary: non-boolean `grow`/`enabled`, non-numeric `height`/`width`/`expandedHeight` → resolver defaults, never crash.
- Clamps: panel `height` `[80, 900]`; notch `width` `[240, 900]`, `expandedHeight` `[80, 600]`.
- `grow` and a fixed `height` are mutually exclusive — `grow` true forces `height` null; setting a height turns `grow` off.
- Gates: `npm test` (Vitest), `npm run typecheck`, `npm run build`. The two pure resolvers are unit-tested; drag/notch/DOM behavior is manually verified in `npm run dev` and reported as manually-verifiable-only — never fabricate an automated pass for it.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/shared/types.ts` | `ModuleConfig.grow/height`; `NotchConfig`; `UiConfig.notch?`. |
| `src/renderer/src/lib/resolvePanelSize.ts` | **New, pure.** `resolvePanelSize` + `DEFAULT_GROW`. |
| `src/shared/resolveNotch.ts` | **New, pure.** `resolveNotch` + `ResolvedNotch` (shared main+renderer). |
| `src/renderer/src/hud/App.tsx` | panel flex from `resolvePanelSize`; bottom-edge height drag; use `DEFAULT_GROW`. |
| `src/main/notch.ts` | `createNotchWindow(cfg)` + exported `applyNotchBounds(win, cfg)`; size from config. |
| `src/main/index.ts` | resolve notch at startup, gate on `enabled`, capture `notchWin`, live re-pin. |
| `src/renderer/src/components/settings/LayoutTab.tsx` | per-panel grow/height rows; Notch section. |
| `tests/resolvePanelSize.test.ts`, `tests/resolveNotch.test.ts` | **New.** Unit tests. |

---

## Task 1: Pure resolvers + types

Purely additive — new files + optional type fields. Tree stays green.

**Files:**
- Create: `src/renderer/src/lib/resolvePanelSize.ts`, `src/shared/resolveNotch.ts`
- Modify: `src/shared/types.ts` (`ModuleConfig`, add `NotchConfig`, `UiConfig.notch?`)
- Test: `tests/resolvePanelSize.test.ts`, `tests/resolveNotch.test.ts`

**Interfaces:**
- Produces: `resolvePanelSize(cfg: ModuleConfig | undefined, isDefaultGrow: boolean): { grow: boolean; height: number | null }`; `DEFAULT_GROW: Set<string>`; `resolveNotch(cfg: NotchConfig | undefined): ResolvedNotch` where `ResolvedNotch = { enabled: boolean; width: number; expandedHeight: number }`.

- [ ] **Step 1: Extend shared types**

In `src/shared/types.ts`, replace the `ModuleConfig` interface (lines 48-51):

```ts
export interface ModuleConfig {
  enabled?: boolean
  options?: Record<string, unknown>
  grow?: boolean // fill leftover column height (default: id ∈ DEFAULT_GROW)
  height?: number // fixed px height (panel scrolls inside); ignored when grow is true
}
```

Add a `NotchConfig` interface (near the other config interfaces, e.g. after `GeometryConfig`):

```ts
export interface NotchConfig {
  enabled?: boolean // create the notch window at all (default true)
  width?: number // px, default 440
  expandedHeight?: number // px below the menu-bar height, default 140
}
```

Add `notch` to `UiConfig` (after `geometry?`):

```ts
  notch?: NotchConfig
```

- [ ] **Step 2: Write the failing tests**

Create `tests/resolvePanelSize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolvePanelSize, DEFAULT_GROW } from '../src/renderer/src/lib/resolvePanelSize'

describe('resolvePanelSize', () => {
  it('no cfg → grow follows the default-grow flag, no height (parity)', () => {
    expect(resolvePanelSize(undefined, true)).toEqual({ grow: true, height: null })
    expect(resolvePanelSize(undefined, false)).toEqual({ grow: false, height: null })
  })
  it('explicit grow overrides the default', () => {
    expect(resolvePanelSize({ grow: false }, true).grow).toBe(false)
    expect(resolvePanelSize({ grow: true }, false).grow).toBe(true)
  })
  it('height clamps to [80,900] when grow is off', () => {
    expect(resolvePanelSize({ grow: false, height: 20 }, false).height).toBe(80)
    expect(resolvePanelSize({ grow: false, height: 5000 }, false).height).toBe(900)
    expect(resolvePanelSize({ grow: false, height: 300 }, false).height).toBe(300)
  })
  it('grow true forces height null even if a height is set', () => {
    expect(resolvePanelSize({ grow: true, height: 300 }, false)).toEqual({ grow: true, height: null })
  })
  it('fail-soft: non-boolean grow → default; non-number height → null', () => {
    expect(resolvePanelSize({ grow: 'yes' as unknown as boolean }, true).grow).toBe(true)
    expect(resolvePanelSize({ grow: false, height: 'tall' as unknown as number }, false).height).toBe(null)
  })
  it('exports the default-grow set (brain/skills/core)', () => {
    expect(DEFAULT_GROW.has('brain')).toBe(true)
    expect(DEFAULT_GROW.has('skills')).toBe(true)
    expect(DEFAULT_GROW.has('core')).toBe(true)
    expect(DEFAULT_GROW.has('deck')).toBe(false)
  })
})
```

Create `tests/resolveNotch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveNotch } from '../src/shared/resolveNotch'

describe('resolveNotch', () => {
  it('no config → defaults enabled/440/140', () => {
    expect(resolveNotch(undefined)).toEqual({ enabled: true, width: 440, expandedHeight: 140 })
  })
  it('enabled false is respected', () => {
    expect(resolveNotch({ enabled: false }).enabled).toBe(false)
  })
  it('width clamps [240,900], expandedHeight clamps [80,600]', () => {
    expect(resolveNotch({ width: 100 }).width).toBe(240)
    expect(resolveNotch({ width: 5000 }).width).toBe(900)
    expect(resolveNotch({ expandedHeight: 10 }).expandedHeight).toBe(80)
    expect(resolveNotch({ expandedHeight: 5000 }).expandedHeight).toBe(600)
  })
  it('fail-soft: non-number/non-boolean → defaults, per field', () => {
    expect(resolveNotch({ width: 'x' as unknown as number }).width).toBe(440)
    expect(resolveNotch({ enabled: 'yes' as unknown as boolean }).enabled).toBe(true)
    expect(resolveNotch({ expandedHeight: NaN }).expandedHeight).toBe(140)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/resolvePanelSize.test.ts tests/resolveNotch.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `resolvePanelSize`**

Create `src/renderer/src/lib/resolvePanelSize.ts`:

```ts
import type { ModuleConfig } from '@shared/types'

// panels that soak leftover column height by default (was the hardcoded GROWS
// set in App). Single source of truth, imported by App and the Layout tab.
export const DEFAULT_GROW = new Set(['brain', 'skills', 'core'])

const HEIGHT_MIN = 80
const HEIGHT_MAX = 900

// grow ⊕ height: a growing panel fills leftover height (height ignored); a
// fixed-height panel scrolls inside its box; neither → hug content. Fail-soft
// at the user-JSON boundary.
export function resolvePanelSize(
  cfg: ModuleConfig | undefined,
  isDefaultGrow: boolean
): { grow: boolean; height: number | null } {
  const grow = typeof cfg?.grow === 'boolean' ? cfg.grow : isDefaultGrow
  if (grow) return { grow: true, height: null }
  const h = cfg?.height
  const height =
    typeof h === 'number' && Number.isFinite(h) ? Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, h)) : null
  return { grow: false, height }
}
```

- [ ] **Step 5: Implement `resolveNotch`**

Create `src/shared/resolveNotch.ts`:

```ts
import type { NotchConfig } from './types'

export interface ResolvedNotch {
  enabled: boolean
  width: number
  expandedHeight: number
}

export const NOTCH_BOUNDS = {
  width: [240, 900],
  expandedHeight: [80, 600]
} as const

function clampNum(v: unknown, def: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def
}

export function resolveNotch(cfg: NotchConfig | undefined): ResolvedNotch {
  return {
    enabled: typeof cfg?.enabled === 'boolean' ? cfg.enabled : true,
    width: clampNum(cfg?.width, 440, NOTCH_BOUNDS.width[0], NOTCH_BOUNDS.width[1]),
    expandedHeight: clampNum(cfg?.expandedHeight, 140, NOTCH_BOUNDS.expandedHeight[0], NOTCH_BOUNDS.expandedHeight[1])
  }
}
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run tests/resolvePanelSize.test.ts tests/resolveNotch.test.ts && npm run typecheck`
Expected: all new tests PASS; typecheck clean (additive).

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/shared/resolveNotch.ts src/renderer/src/lib/resolvePanelSize.ts tests/resolvePanelSize.test.ts tests/resolveNotch.test.ts
git commit -m "feat: resolvePanelSize + resolveNotch pure resolvers + config types"
```

---

## Task 2: Per-panel sizing in App (flex + bottom-edge drag)

**Files:**
- Modify: `src/renderer/src/hud/App.tsx`

**Interfaces:**
- Consumes: `resolvePanelSize`, `DEFAULT_GROW` (Task 1).
- Produces: per-panel live-height drag; `.arrange` flex driven by resolved size.

- [ ] **Step 1: Swap the hardcoded GROWS for the shared set + import the resolver**

In `src/renderer/src/hud/App.tsx`, add to imports:

```ts
import { resolvePanelSize, DEFAULT_GROW } from '../lib/resolvePanelSize'
```

Delete the line `const GROWS = new Set(['brain', 'skills', 'core'])` and replace every `GROWS` reference with `DEFAULT_GROW` (there is the definition line plus its uses in `renderZone`). Simplest: keep the name by aliasing — instead of deleting, replace the definition line with nothing and change the two `GROWS.has(id)` call sites to `DEFAULT_GROW.has(id)`. (One is the old flex line, replaced in Step 3; the other, if any, likewise.)

- [ ] **Step 2: Add per-panel drag state + handler**

Near the other drag state (after `dragValueRef`), add:

```ts
  const [localPanelHeights, setLocalPanelHeights] = useState<Record<string, number>>({})
  const panelDragRef = useRef(false)
  const panelHeightRef = useRef<number | null>(null)
```

Add a clear-effect next to the geometry one:

```ts
  useEffect(() => {
    if (!panelDragRef.current) setLocalPanelHeights({})
  }, [JSON.stringify(snap?.ui.modules)])
```

Add the drag handler near `startResize`:

```ts
  const startPanelResize = (id: string, e: ReactMouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    panelDragRef.current = true
    const wrapper = (e.currentTarget as HTMLElement).parentElement as HTMLElement
    const startY = e.clientY
    const startH = wrapper.offsetHeight
    const onMove = (ev: MouseEvent): void => {
      const h = Math.max(80, Math.min(900, startH + (ev.clientY - startY)))
      panelHeightRef.current = h
      setLocalPanelHeights((m) => ({ ...m, [id]: h }))
    }
    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('blur', onUp)
      panelDragRef.current = false
      const h = panelHeightRef.current
      if (h != null) {
        window.vault.updateConfig({ ui: { modules: { ...snap.ui.modules, [id]: { ...snap.ui.modules?.[id], grow: false, height: h } } } })
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('blur', onUp)
  }
```

- [ ] **Step 3: Drive the `.arrange` wrapper from the resolved size + add the handle**

In `renderZone`, inside the `zones[zoneIdx].map((id) => { ... })` body, after the `if (!enabled) return null` line, compute the size:

```ts
            const size = resolvePanelSize(snap.ui.modules?.[id], DEFAULT_GROW.has(id))
            const liveH = localPanelHeights[id]
            const pGrow = liveH != null ? false : size.grow
            const pHeight = liveH ?? size.height
```

Replace the returned `.arrange` `<div>` (currently lines ~239-286) with this version — `position: relative`, flex from the resolved size, an inner scroll box holding the grip + content, and a bottom-edge `row-resize` handle:

```tsx
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
                  position: 'relative',
                  // a growing panel soaks leftover height; a fixed-height panel is that
                  // tall and scrolls inside; otherwise it hugs its content
                  flex: pGrow ? '1 0 auto' : pHeight != null ? `0 0 ${pHeight}px` : '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: drag === id ? 0.35 : 1,
                  outline: over === id ? '1px dashed var(--clay)' : 'none',
                  outlineOffset: 1,
                  transition: 'opacity 120ms ease'
                }}
              >
                <div style={{ flex: 1, minHeight: 0, overflowY: pHeight != null ? 'auto' : 'visible', display: 'flex', flexDirection: 'column' }}>
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
                <div
                  className="panel-vresize"
                  title="drag to resize height"
                  onMouseDown={(e) => startPanelResize(id, e)}
                  style={{ position: 'absolute', left: 0, right: 0, bottom: -3, height: 6, cursor: 'row-resize', zIndex: 4 }}
                />
              </div>
            )
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, typecheck clean, build exit 0.

- [ ] **Step 5: Manual smoke (DOM)**

In `npm run dev`: a no-config HUD looks identical to before (brain/skills/core still grow, others hug); drag a panel's bottom edge → it takes a fixed height and its content scrolls inside; the height persists across a reload; grabbing the bottom edge of a growing panel switches it to fixed height. Report observations.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/hud/App.tsx
git commit -m "feat: per-panel height — resolved flex + bottom-edge drag handle"
```

---

## Task 3: Notch config wiring (main process)

**Files:**
- Modify: `src/main/notch.ts`, `src/main/index.ts`

**Interfaces:**
- Consumes: `resolveNotch`, `ResolvedNotch` from `@shared/resolveNotch` (Task 1).
- Produces: `createNotchWindow(cfg: ResolvedNotch): BrowserWindow`; `applyNotchBounds(win: BrowserWindow, cfg: ResolvedNotch): void`.

- [ ] **Step 1: Make `createNotchWindow` config-driven + export `applyNotchBounds`**

In `src/main/notch.ts`, add the import:

```ts
import type { ResolvedNotch } from '@shared/resolveNotch'
```

Change the signature `export function createNotchWindow(): BrowserWindow {` to `export function createNotchWindow(cfg: ResolvedNotch): BrowserWindow {`, and replace the `const size = { width: NOTCH_WIDTH, height: m + 140 }` line with:

```ts
  const size = { width: cfg.width, height: m + cfg.expandedHeight }
```

(Keep `NOTCH_WIDTH` exported for back-compat, but it's no longer used for the window size.) At the end of the file, add:

```ts
// re-pin the notch centered at the top with a new size — a plain resize (NOT
// the expand/collapse animation, which stays pure CSS), used for live config edits
export function applyNotchBounds(win: BrowserWindow, cfg: ResolvedNotch): void {
  const d = screen.getPrimaryDisplay()
  const width = cfg.width
  const height = menuBarHeight() + cfg.expandedHeight
  win.setBounds({ x: Math.round(d.bounds.x + d.bounds.width / 2 - width / 2), y: d.bounds.y, width, height })
}
```

- [ ] **Step 2: Resolve notch at startup, gate on `enabled`, capture the window**

In `src/main/index.ts`, update imports:

```ts
import { createNotchWindow, applyNotchBounds } from './notch'
import { resolveNotch } from '@shared/resolveNotch'
```

Add a module-level ref beside `hudWin`:

```ts
let notchWin: BrowserWindow | null = null
```

Replace the `createNotchWindow()` call (line ~143) with:

```ts
  const nc = resolveNotch(config.ui.notch)
  if (nc.enabled) notchWin = createNotchWindow(nc)
```

- [ ] **Step 3: Live re-pin on config change**

In the `IPC.updateConfig` handler, after `await state.refreshAll()`, add:

```ts
      if (patch.ui?.notch && notchWin && !notchWin.isDestroyed()) {
        applyNotchBounds(notchWin, resolveNotch(config.ui.notch))
      }
```

(`config.ui.notch` already reflects the new value via the handler's earlier `Object.assign(config.ui, patch.ui)`.)

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass / clean / exit 0.

- [ ] **Step 5: Manual smoke (DOM/window)**

In `npm run dev`: with no notch config, the notch looks/behaves exactly as before (440 wide). Add `"ui": { "notch": { "width": 520, "expandedHeight": 180 } }` to `~/.vault-hud/config.json` and change it via Settings (Task 4) → the notch window resizes live. Set `"enabled": false` and restart → no notch window. Report observations.

- [ ] **Step 6: Commit**

```bash
git add src/main/notch.ts src/main/index.ts
git commit -m "feat: config-driven notch window (enabled/width/height) + live re-pin"
```

---

## Task 4: Settings — per-panel grow/height + Notch section

**Files:**
- Modify: `src/renderer/src/components/settings/LayoutTab.tsx`

**Interfaces:**
- Consumes: `resolvePanelSize`, `DEFAULT_GROW` (Task 1); `resolveNotch` from `@shared/resolveNotch` (Task 1); primitives.

- [ ] **Step 1: Imports + per-panel/notch handlers**

In `src/renderer/src/components/settings/LayoutTab.tsx`, add imports:

```ts
import { resolvePanelSize, DEFAULT_GROW } from '../../lib/resolvePanelSize'
import { resolveNotch } from '@shared/resolveNotch'
```

Inside `LayoutTab`, add handlers (near the other write helpers):

```ts
  const setGrow = (id: string, grow: boolean): void =>
    window.vault.updateConfig({ ui: { modules: { ...snap.ui.modules, [id]: { ...snap.ui.modules?.[id], grow, ...(grow ? { height: undefined } : {}) } } } })
  const setHeight = (id: string, h: number | null): void =>
    window.vault.updateConfig({ ui: { modules: { ...snap.ui.modules, [id]: { ...snap.ui.modules?.[id], grow: false, height: h == null ? undefined : Math.max(80, Math.min(900, h)) } } } })
  const notch = resolveNotch(snap.ui.notch)
  const setNotch = (patch: Partial<{ enabled: boolean; width: number; expandedHeight: number }>): void =>
    window.vault.updateConfig({ ui: { notch: { ...snap.ui.notch, ...patch } } })
```

- [ ] **Step 2: Replace the per-zone module chips with per-panel control rows**

In the ZONES section, the inner module list currently renders each module id as a chip with a move `Picker`. Replace that inner `z.map((id) => ( ... ))` block with per-panel rows that add grow + height controls:

```tsx
              {z.length === 0 && <span className="dim" style={{ fontSize: 10 }}>empty</span>}
              {z.map((id) => {
                const size = resolvePanelSize(snap.ui.modules?.[id], DEFAULT_GROW.has(id))
                return (
                  <div key={id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 10 }}>
                    <span style={{ minWidth: 58, color: 'var(--ink)' }}>{id}</span>
                    <Picker value={String(i)} options={zoneNames} onPick={(t) => moveModule(id, Number(t))} />
                    <Toggle on={size.grow} label="grow" onClick={() => setGrow(id, !size.grow)} />
                    {!size.grow && (
                      <Stepper
                        value={size.height ?? 'auto'}
                        suffix={size.height != null ? 'px' : ''}
                        onDec={() => setHeight(id, (size.height ?? 200) - 20)}
                        onInc={() => setHeight(id, (size.height ?? 200) + 20)}
                      />
                    )}
                    {size.height != null && (
                      <button onClick={() => setHeight(id, null)} style={{ fontSize: 10 }}>auto</button>
                    )}
                  </div>
                )
              })}
```

(This replaces the old chip markup; `moveModule`, `zoneNames`, and the zone index `i` are the same ones already in scope in the zone-card map from Task 3 of sub-project G.)

- [ ] **Step 3: Add the Notch section**

After the `CORE SIZE` section (before the closing `</>`), add:

```tsx
      <Section title="NOTCH">
        <Row label="NOTCH">
          <Toggle
            on={notch.enabled}
            label={notch.enabled ? 'on' : 'off — restart to apply'}
            onClick={() => setNotch({ enabled: !notch.enabled })}
          />
        </Row>
        <Row label="WIDTH">
          <Stepper value={notch.width} suffix="px" onDec={() => setNotch({ width: notch.width - 20 })} onInc={() => setNotch({ width: notch.width + 20 })} />
        </Row>
        <Row label="EXPAND">
          <Stepper value={notch.expandedHeight} suffix="px" onDec={() => setNotch({ expandedHeight: notch.expandedHeight - 20 })} onInc={() => setNotch({ expandedHeight: notch.expandedHeight + 20 })} />
        </Row>
      </Section>
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass / clean / exit 0.

- [ ] **Step 5: Manual smoke (DOM)**

In `npm run dev`, Layout tab: each panel row shows grow / height stepper / auto — toggle grow and watch the panel fill or hug; step a height and watch the panel resize; auto clears it. The NOTCH section: width/expand steppers resize the notch live; the enabled toggle notes restart. Report observations.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/settings/LayoutTab.tsx
git commit -m "feat: Settings per-panel grow/height controls + Notch section"
```

---

## Self-Review

- **Spec coverage:** ModuleConfig grow/height + NotchConfig + UiConfig.notch (T1) ✓; resolvePanelSize with GROWS-parity default + clamp + grow-wins + fail-soft (T1) ✓; resolveNotch defaults/clamp/fail-soft (T1) ✓; `.arrange` flex from resolved size + overflow (T2) ✓; bottom-edge height drag with blur safety-net + optimistic local state + clear-effect (T2) ✓; DEFAULT_GROW single-sourced, replaces App's GROWS (T1/T2) ✓; notch config-driven size + enabled gate + captured ref + live re-pin (T3) ✓; Settings per-panel grow/height/auto + Notch section (T4) ✓; every write spreads the slice (T2/T4) ✓; no-config parity (resolver tests + default-grow) ✓.
- **Placeholders:** none — every code step shows complete code; manual-smoke steps are flagged un-automatable, not faked.
- **Type consistency:** `resolvePanelSize(cfg, isDefaultGrow) → {grow, height}`, `DEFAULT_GROW: Set<string>`, `resolveNotch(cfg) → ResolvedNotch {enabled,width,expandedHeight}`, `createNotchWindow(cfg)`, `applyNotchBounds(win, cfg)`, `setGrow`/`setHeight`/`setNotch` — consistent T1→T4. Shared `resolveNotch` in `src/shared` so `main` can import it (`@shared/resolveNotch`); `resolvePanelSize` in renderer lib.
- **Ordering:** T1 additive/green; T2 (renderer panel), T3 (main notch), T4 (settings) each independently testable and green at the end.
