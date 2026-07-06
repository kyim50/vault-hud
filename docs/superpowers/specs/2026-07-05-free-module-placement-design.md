# Free Module Placement — arrange any panel in any zone

Date: 2026-07-05
Surface: `src/renderer/src/hud/App.tsx` + new pure `lib/resolveLayout.ts`
+ `lib/resolveGeometry.ts` (generalized) + `src/shared/types.ts`
+ `src/renderer/src/modules/types.ts`

Sub-project **D** of the vault-hud customization arc (see
[[project-vault-hud-customization]]). Goal: turn the fixed *left column ·
hardcoded Core center · right column* into an **arbitrary number of zones**,
where every panel — the Core included — is a draggable module that can live in
any zone, in any order. This is the "arrange anything anywhere" step: put the
Core off to the side, drop Second Brain in the center, split into five thin
columns, or collapse to one wide one.

Intra-zone panel sizing and the notch are explicitly **out of scope** — they
belong to sub-project E. This sub-project covers *placement*, *zone count*, and
*zone width* (width is intrinsic to a zone existing).

## The two structural changes

### 1. Core becomes a module

Today the Core is hardcoded JSX in the center grid slot (`App.tsx`), separate
from the `MODULES` registry. It becomes a real registry entry:

```ts
core: { id: 'core', defaults: {}, render: (s, _o, ctx) => (
  <Panel title="Core" corner={…chart toggle…} style={{ flex: 1, border: 'none', padding: '8px 0' }}>
    <CoreScene … chart={ctx.chart} scenes={s.ui.scenes} maxWidth={ctx.coreMax} />
    <div …><PrimaryDirective {...s.primary} /></div>
  </Panel>
) }
```

The Core needs two things ordinary modules don't: the ✦CHART toggle state and
the resolved `coreMax`. Rather than special-case it, the module `render`
signature gains an optional third arg — a small **RenderContext** that every
module receives and most ignore:

```ts
// modules/types.ts
export interface RenderContext {
  chart: boolean
  setChart: (fn: (c: boolean) => boolean) => void
  coreMax: number
}
export interface HudModule<Opt> {
  id: string
  defaults: Opt
  render: (snap: HudSnapshot, opts: Opt, ctx: RenderContext) => ReactNode
}
```

The ✦CHART sticky-mode state and its `Esc` handler stay lifted in `App` (as
today) and flow into the Core module through `ctx`. Existing modules keep their
two-arg call working (the third arg is just ignored) — no other module file
changes.

### 2. Layout becomes an array of zones

```ts
// shared/types.ts — PanelLayout gains `zones`; left/right kept optional for migration
export interface PanelLayout {
  zones?: string[][]   // ordered zones, each an ordered list of module ids
  left?: string[]      // legacy — migrated to zones, then ignored
  right?: string[]     // legacy
}
```

`zones.length` is the number of columns. `resolveLayout` (new, pure,
unit-tested) turns whatever is in config into a clean `string[][]`:

- **Migration:** if `zones` is absent but legacy `left`/`right` exist, produce
  `[left, ['core'], right]` — the old two-column-plus-center shape, with Core
  now explicit in the middle. This preserves an already-riced config (Kimani's
  live `layout.left/right` + Neon Deck survive the upgrade).
- **Sanitize:** drop ids not in `MODULES`; keep each id at most once across all
  zones (first occurrence wins); drop empty-string / non-array garbage.
- **Fail-soft:** if the result has zero zones (or `zones` is not an array of
  arrays), fall back to `DEFAULT_ZONES`. Any module id present in `MODULES` but
  absent from every zone is **not** force-appended — a user may legitimately
  remove a panel (including the Core); removal must stick.

```ts
const DEFAULT_ZONES: string[][] = [
  ['fetch', 'vitals', 'directives', 'brain'],
  ['core'],
  ['deck', 'schedule', 'totem', 'skills']
]
```

With no config, `resolveLayout(undefined)` returns `DEFAULT_ZONES` and the HUD
is **byte-identical to today** (this parity is locked by a unit test).

## Zone width & the flex zone

Each zone needs a width. `GeometryConfig` generalizes:

```ts
export interface GeometryConfig {
  zoneWidths?: number[]   // px per zone, index-aligned with layout.zones
  flexZone?: number       // index of the zone that soaks leftover width (the `1fr`)
  coreMax?: number        // px, Core canvas max width (unchanged)
  leftWidth?: number      // legacy — migrated
  rightWidth?: number     // legacy
}
```

`resolveGeometry(cfg, zoneCount)` now takes the zone count and returns:

```ts
export interface ResolvedGeometry {
  zoneWidths: number[]    // length === zoneCount; the flex zone's entry is ignored for layout
  flexZone: number        // clamped to [0, zoneCount-1]
  coreMax: number
}
```

- **Per-zone width** clamped to `[180, 460]` (same bounds as today), default
  `260` for any zone lacking a stored width.
- **Migration:** legacy `{ leftWidth, rightWidth }` with the migrated 3-zone
  layout → `zoneWidths = [leftWidth, <flex placeholder>, rightWidth]`,
  `flexZone = 1`. So Kimani's `leftWidth: 240 / rightWidth: 320` carry over.
- **flexZone default:** the zone containing `core` if present, else the middle
  index, clamped into range. Fail-soft on non-numbers throughout (the existing
  `clampNum` helper).

The grid template is built from the resolved widths:
`gridTemplateColumns = zoneWidths.map((w, i) => i === flexZone ? '1fr' : `${w}px`).join(' ')`.
If `flexZone` somehow lands out of range after clamping to an empty edge case,
the first zone flexes (guaranteed non-empty since `zoneCount ≥ 1`).

## Interaction

- **Drag any panel to any zone / reorder within a zone** — the existing
  `move(dragId, col, before?)` generalizes from `'left' | 'right'` to a numeric
  zone index. The `⠿` grip, `armed`/`drag`/`over` state, drop-on-panel and
  drop-on-empty-column behaviors are unchanged in spirit, just indexed by zone.
  `over` keys become `zone:${i}` and `${moduleId}`.
- **Add a zone** — a slim `+` affordance in the left and right gutters appends
  or prepends an empty zone. A new zone gets the default width and is a valid
  drop target.
- **Remove a zone** — an empty zone renders a dashed "drop here" placeholder
  with a `✕`; clicking `✕` removes it. A non-empty zone has no `✕` (drag its
  panels out first). Minimum **one** zone always — the last zone cannot be
  removed.
- **Zone width handles** — the current `resize-handle` generalizes to sit on the
  inner boundary between each adjacent pair of zones. Dragging adjusts the
  fixed-width zone on the handle's side (the flex zone has no handle of its own;
  it absorbs the slack). Persists on mouse-up with the blur safety-net already
  in place. Live-drag uses the existing `localGeometry` optimistic pattern,
  generalized to `zoneWidths[i]`.

All layout/geometry writes must **spread the current slice** (the shallow-merge
caveat from B/C): `updateConfig({ ui: { geometry: { ...snap.ui.geometry, zoneWidths: next } } })`.

## Settings

D ships only the drag + minimal `+`/`✕` add-remove and the width handles. The
polished zone manager (a visual builder, per-zone module checklists, reorder,
flex-zone picker) is deferred to **G** (Settings rice studio). No
`SettingsPanel.tsx` change in D beyond what already exists.

## Files

| File | Change |
|---|---|
| `lib/resolveLayout.ts` | **New** — pure `resolveLayout(cfg)` → `string[][]` (migration + sanitize + fail-soft); exports `DEFAULT_ZONES`. Unit-tested. |
| `lib/resolveGeometry.ts` | Generalize to `zoneWidths`/`flexZone` keyed by zone count; migrate legacy `leftWidth/rightWidth`; keep `coreMax`. Unit-tested. |
| `shared/types.ts` | `PanelLayout.zones`; `GeometryConfig.zoneWidths/flexZone`; legacy fields kept optional. |
| `modules/types.ts` | Add `RenderContext`; widen `HudModule.render` third arg. |
| `hud/App.tsx` | `core` module def; zone-array render loop replaces the 3 hardcoded regions; `move`/`startResize`/`over` indexed by zone; `+`/`✕` affordances; RenderContext passed to `mod.render`. |

## Testing

- **`resolveLayout`** (TDD, pure): no config → `DEFAULT_ZONES` (parity);
  legacy `{left,right}` → `[left,['core'],right]`; drops unknown ids;
  dedupes an id across zones; empty/garbage → `DEFAULT_ZONES`; a user-removed
  module (including `core`) stays removed (not re-appended).
- **`resolveGeometry`** (TDD, pure): N-zone widths clamp/default; legacy
  `leftWidth/rightWidth` → 3-entry `zoneWidths` with `flexZone=1`; `flexZone`
  clamped into `[0, zoneCount-1]`; fail-soft on non-numbers; `coreMax`
  unchanged.
- **Registry** test: `core` exists in `MODULES`; every id in `DEFAULT_ZONES`
  resolves in the registry.
- **CoreScene / App / drag** — manual in `npm run dev`: drag Core to a side
  zone and Brain to the center; add a 4th zone and populate it; delete an
  emptied zone; drag a zone boundary to resize; confirm a no-config HUD looks
  identical to today; confirm the existing riced config still loads.

## Fail-soft summary (the recurring lesson from B/C)

Every field crossing the user-editable-JSON boundary is validated: non-array
`zones`, non-string ids, out-of-range `flexZone`, non-numeric widths, zero
zones — each falls back rather than crashing the HUD. The resolvers are the
single choke point; `App` trusts their output.
