# Per-Panel Sizing + Customizable Notch — the last customization piece

Date: 2026-07-06
Surface: `src/shared/types.ts` + new `lib/resolvePanelSize.ts` + new
`lib/resolveNotch.ts` + `modules/resolve.ts` + `hud/App.tsx` +
`settings/LayoutTab.tsx` + `main/notch.ts` + `main/index.ts`

Sub-project **E** (the final piece) of the vault-hud customization arc (see
[[project-vault-hud-customization]]). Two capabilities Kimani asked for:
"resize individual panels as well" (not just zones/Core), and "the notch should
also be customizable". After E, the whole arc (A theme · B scenes · C resizing ·
D free placement · G rice studio · E) is ready for the big merge to `main`.

## Part 1 — Per-panel sizing

### Model

Today each panel is wrapped in an `.arrange` div with
`flex: GROWS.has(id) ? '1 0 auto' : '0 0 auto'`, where `GROWS` is a hardcoded
set (`brain`, `skills`, `core`). Panels in `GROWS` soak leftover column height;
the rest hug their content. There is no per-panel height control.

Extend the existing per-module rice slice `ModuleConfig` (currently
`{ enabled?, options? }`):

```ts
export interface ModuleConfig {
  enabled?: boolean
  options?: Record<string, unknown>
  grow?: boolean   // fill leftover column height (default: id ∈ GROWS)
  height?: number  // fixed px height (panel scrolls inside); ignored when grow is true
}
```

A pure `resolvePanelSize(cfg, isDefaultGrow)` (new, unit-tested) returns
`{ grow: boolean; height: number | null }`:

- `grow` = `cfg.grow` when it's a boolean, else `isDefaultGrow` (the caller
  passes `GROWS.has(id)`), so **no-config parity is exact**.
- `height` = a finite `cfg.height` clamped to `[80, 900]`, else `null`. When
  `grow` is true, `height` is forced to `null` (grow wins).
- Fail-soft: non-boolean `grow`, non-numeric `height` → fall back (same lesson
  as the other resolvers).

`resolveModule` grows to also return sizing (or App calls `resolvePanelSize`
directly with the module's cfg). App's `.arrange` style becomes:

```ts
const { grow, height } = resolvePanelSize(snap.ui.modules?.[id], GROWS.has(id))
flex: grow ? '1 0 auto' : height ? `0 0 ${height}px` : '0 0 auto',
overflow: height ? 'auto' : undefined,   // a fixed-height panel scrolls inside its box
```

### Interaction

- **Drag** a panel's bottom edge — a thin `row-resize` handle at the panel's
  foot (mirrors D's zone-width handles). Dragging sets `height` live via an
  optimistic local state; grabbing it turns `grow` off for that panel (a fixed
  height and grow are mutually exclusive). Persists on mouse-up with the same
  `blur` safety-net D uses. Write spreads the module slice:
  `updateConfig({ ui: { modules: { ...snap.ui.modules, [id]: { ...snap.ui.modules?.[id], grow: false, height } } } })`.
- **Settings** — in the Layout tab's per-zone cards, each panel chip gains a
  **grow toggle** and a **height stepper** with an **auto** button (clears
  `height` back to content-hug). So panel sizing is fully clickable too.

## Part 2 — Customizable notch

### Model

The notch is a separate `BrowserWindow` created once at a hardcoded
`width: 440`, `height: menuBar + 140`, pinned top-center, never resized (its
expand/collapse is pure CSS). New config slice:

```ts
export interface NotchConfig {
  enabled?: boolean       // create the notch window at all (default true)
  width?: number          // px, default 440
  expandedHeight?: number // px added below the menu-bar height, default 140
}
```

A pure `resolveNotch(cfg)` (new, unit-tested) → `{ enabled, width, expandedHeight }`
with defaults `true / 440 / 140`, `width` clamped `[240, 900]`,
`expandedHeight` clamped `[80, 600]`, fail-soft on non-numbers/non-booleans.

### Wiring

- `createNotchWindow(cfg: ResolvedNotch)` takes the resolved notch config.
  `main/index.ts` (where `config` is already in scope at the call site) does:
  `const nc = resolveNotch(config.ui.notch); if (nc.enabled) notchWin = createNotchWindow(nc)`.
  The window size becomes `{ width: nc.width, height: menuBarHeight() + nc.expandedHeight }`,
  and the `mh` hash the renderer already reads is unchanged (still the true
  menu-bar height).
- **Live resize:** `main/index.ts` captures the window into a module-level
  `notchWin` (like `hudWin`). The `updateConfig` handler, when `patch.ui?.notch`
  is present and `notchWin` is alive, re-applies bounds via an exported
  `applyNotchBounds(win, nc)` that re-pins centered with the new size. So width
  and expanded-height changes apply **live** (this is a plain resize, not the
  expand animation — safe).
- **enabled toggle:** creating/destroying a window mid-session is heavier;
  toggling `enabled` applies on **restart** (the Settings note says so). Width /
  height apply live.

### Settings

A **Notch** section in the Settings **Layout** tab: an **enabled** toggle
(with a "restart to apply" note), a **width** stepper, and an
**expanded-height** stepper — all writing `ui.notch` (spread the slice).

## Scope boundary (YAGNI)

- Panel sizing is **height + grow** only; panel *width* is the zone's job (D).
- Notch customization is **geometry + on/off** only; notch *content* (the
  STATUS/PLAN/GIT/RUN tabs, the mascot) is out of scope.

## Files

| File | Change |
|---|---|
| `shared/types.ts` | `ModuleConfig.grow/height`; `NotchConfig`; `UiConfig.notch?`. |
| `lib/resolvePanelSize.ts` | **New, pure.** `resolvePanelSize(cfg, isDefaultGrow)`. Unit-tested. |
| `lib/resolveNotch.ts` | **New, pure.** `resolveNotch(cfg)` + bounds. Unit-tested. |
| `hud/App.tsx` | `.arrange` flex from `resolvePanelSize`; bottom-edge height drag handle. |
| `settings/LayoutTab.tsx` | per-panel grow toggle + height stepper (auto); Notch section. |
| `main/notch.ts` | `createNotchWindow(cfg)` + exported `applyNotchBounds(win, cfg)`; sizing from config. |
| `main/index.ts` | resolve notch at startup, gate on `enabled`, capture `notchWin`, live re-pin on `updateConfig`. |

## Testing

- **`resolvePanelSize`** (TDD): no cfg → `{ grow: isDefaultGrow, height: null }`
  (parity); explicit `grow:false`/`true` overrides; `height` clamps `[80,900]`;
  `grow` true forces `height: null`; fail-soft on non-boolean/non-number.
- **`resolveNotch`** (TDD): defaults `true/440/140`; clamps; fail-soft; each
  field independent.
- **App drag / Settings / notch** — manual in `npm run dev` (typecheck+build are
  the automated gate): drag a panel's bottom edge to resize its height and see
  it scroll; toggle grow / step height / auto in Settings; a no-config HUD is
  byte-identical to today; set `ui.notch.width`/`expandedHeight` and watch the
  notch resize live; `enabled:false` hides the notch on restart.

## Fail-soft & constraints

- No-config behavior byte-identical to today (parity locked by resolver tests:
  `grow` defaults to `GROWS` membership; notch defaults 440/140/enabled).
- Every config write spreads the current slice (shallow-merge caveat).
- Branch `vaultfetch`; no `Co-Authored-By` trailer. E is the last sub-project —
  after it, the arc merges to `main`.
