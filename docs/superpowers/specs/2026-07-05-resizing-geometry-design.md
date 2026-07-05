# Resizing / Geometry — drag-resizable columns + Core

Date: 2026-07-05
Surface: `src/renderer/src/hud/App.tsx` + a new pure `lib/resolveGeometry.ts`
+ `src/shared/types.ts` + `CoreScene.tsx` (maxWidth prop) + `SettingsPanel.tsx`

## Part A — Vision & place in the roadmap

Sub-project **C** (the last) of the vault-hud customization arc (see
[[project-vault-hud-customization]]). Lets the user resize the HUD's geometry — the two
side-column widths and the Core's max size — by **dragging** the column dividers, with the
result persisted to config so it is shareable and hand-editable. Narrowing a side column
widens the Core in the middle.

All customization sub-projects accumulate on the `vaultfetch` branch and merge together at
the end (after this one). Repo rule: **no Claude co-author trailer** on any commit.

## Part B — Current state

`App.tsx` fixes the whole layout in one place: `gridTemplateColumns: '280px 1fr 300px'`
(left panels / Core / right panels), `gap: 8`, `padding: 26`, `height: 100vh`. The three
grid children are placed by source order: `renderColumn('left')` (col 1), the center Core
`<Panel>` (col 2, `1fr`), `renderColumn('right')` (col 3). The header + config banner span
`gridColumn: '1 / -1'`. The Core canvas is capped at `maxWidth: 560` inside `CoreScene.tsx`
(line 1131). Panel internal padding is already themable (density, sub-project A).

Nothing here is user-adjustable today — that is what this sub-project adds.

## Part C — Data model

A new config slice `ui.geometry`, riding the snapshot via the existing `ui: { ...config.ui }`
and merging fail-soft through `mergeConfig`'s `ui` spread (no main-process change beyond the
type):

```ts
interface GeometryConfig {
  leftWidth?: number   // px, default 280
  rightWidth?: number  // px, default 300
  coreMax?: number     // px, Core canvas max width, default 560
}
```

Added to `UiConfig` as `geometry?: GeometryConfig`.

### Resolver (pure, testable) — `lib/resolveGeometry.ts`

```ts
interface ResolvedGeometry { leftWidth: number; rightWidth: number; coreMax: number }
export function resolveGeometry(cfg: GeometryConfig | undefined): ResolvedGeometry
```

- Defaults: `leftWidth 280`, `rightWidth 300`, `coreMax 560`.
- Clamps: `leftWidth`/`rightWidth` → `[180, 460]`; `coreMax` → `[360, 1000]`.
- Fail-soft: each field is used only when it is a finite number
  (`typeof === 'number' && Number.isFinite(...)`); a string/`NaN`/missing value falls back
  to its default (same runtime-trust-boundary lesson as `resolveScenes`).
- Exported clamp bounds (`GEOMETRY_BOUNDS = { leftWidth: [180,460], rightWidth: [180,460], coreMax: [360,1000] }`)
  so the drag handlers and Settings steppers clamp with the same numbers (single source).

Pure — no DOM. Unit-tested.

## Part D — Drag interaction (in `App.tsx`)

- `gridTemplateColumns` becomes `` `${g.leftWidth}px 1fr ${g.rightWidth}px` `` from the
  effective geometry. The Core stays `1fr` — narrowing a side column widens the Core.
- **Effective geometry** = `localGeometry ?? resolveGeometry(snap.ui.geometry)`. A
  `localGeometry` React state (like the existing optimistic `localLayout`) holds the live
  value mid-drag; when null, the resolved config value is used.
- **Resize handles:** each side column (`renderColumn` output) becomes `position: relative`
  and gets a thin resize handle on its **inner** edge — the left column's handle on its
  right edge, the right column's on its left edge. Each is `position: absolute`, full column
  height, ~8px wide, `cursor: col-resize`, with a subtle clay hairline on hover. Because the
  handle lives inside the column, it aligns to the column and naturally sits below the header.
- **Drag mechanics** (per handle):
  - `onMouseDown`: record `startX = e.clientX`, `startWidth` (current left/right width), and
    which side; attach `mousemove` + `mouseup` on `window`; prevent text selection.
  - `onMouseMove`: `delta = e.clientX - startX`. Left handle → `leftWidth = startWidth + delta`;
    right handle → `rightWidth = startWidth - delta` (dragging inward widens that column).
    Clamp with `GEOMETRY_BOUNDS`; set `localGeometry` → layout resizes live.
  - `onMouseUp`: detach listeners; persist the final geometry with
    `updateConfig({ ui: { geometry: { ...snap.ui.geometry, [field]: value } } })`; clear
    `localGeometry` on the next snapshot (or keep until the fresh snapshot arrives — see below).
- **Persistence timing:** write config **once, on release** — not per `mousemove`. Live
  feedback comes from `localGeometry`; the config write happens once per drag. `localGeometry`
  is cleared when the updated snapshot arrives so the resolved config becomes the source of
  truth again.
- **Core size:** `CoreScene`'s hardcoded `maxWidth: 560` becomes a `maxWidth?: number` prop
  (default 560); `App.tsx` passes `maxWidth={g.coreMax}`. Dragging the sides in *and* raising
  `coreMax` lets the mascot grow into the freed space.

## Part E — Settings (`SettingsPanel.tsx`)

A "SIZE" section with steppers (mirroring the scene SPEED control), for precision +
discoverability alongside the drag:
- `[−] left {n}px [+]`, `[−] right {n}px [+]`, `[−] core {n}px [+]` — step 20px, clamped with
  `GEOMETRY_BOUNDS`.
- A **reset** control that clears geometry to defaults:
  `updateConfig({ ui: { geometry: {} } })`.
- Shallow-merge caveat (as with scenes): every write spreads `{ ...snap.ui.geometry, <field>: n }`
  so the other fields survive `updateConfig`'s `Object.assign(config.ui, patch.ui)`.

## Part F — Files & modules

| File | Change |
|------|--------|
| `src/renderer/src/lib/resolveGeometry.ts` | **New** — pure resolver + `GEOMETRY_BOUNDS`, unit-tested |
| `src/shared/types.ts` | Add `GeometryConfig` + `UiConfig.geometry?` |
| `src/renderer/src/hud/App.tsx` | Resolved grid widths; `localGeometry` state + two drag handles; pass `maxWidth={g.coreMax}` |
| `src/renderer/src/components/CoreScene.tsx` | `maxWidth: 560` → a `maxWidth?: number` prop (default 560) |
| `src/renderer/src/components/SettingsPanel.tsx` | SIZE steppers + reset |

## Part G — Testing

- `tests/resolveGeometry.test.ts` — TDD:
  - no config → `{ 280, 300, 560 }`.
  - below/above bounds clamp (e.g. `leftWidth: 50` → 180; `coreMax: 5000` → 1000).
  - fail-soft: `leftWidth: '300px'` / `NaN` → default 280; each field independent.
  - a valid in-range value passes through unchanged.
- Manual (`npm run dev`): drag the left divider → left column resizes live and the Core
  grows/shrinks; release → persists across reload; drag the right divider likewise; steppers
  + reset work; dragging past a clamp bound stops cleanly (no runaway / no zero-width column).

## Out of scope

- Resizing individual **panel heights** (panels hug content / flex today) and reordering
  (already draggable) — not part of this.
- Resizing the **Electron window** default size (users resize via the OS; a config default
  is a possible later add).
- A separate Core drag handle — the side dividers already resize the Core via the `1fr`
  middle; `coreMax` is set by stepper/config.
- Vertical (row-height) resizing.
