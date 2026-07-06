# Settings Rice Studio — the complete, no-editor control panel + rice sharing

Date: 2026-07-05
Surface: `src/renderer/src/components/SettingsPanel.tsx` (rewritten into a shell)
+ new `src/renderer/src/components/settings/` (primitives + per-tab components)
+ new pure `src/renderer/src/lib/rice.ts` + `src/shared/types.ts` (RiceBundle)

Sub-project **G** of the vault-hud customization arc (see
[[project-vault-hud-customization]]). Goal: turn the cramped, clipping Settings
overlay into a proper **rice studio** — a tabbed control panel where a non-dev
can change *everything* about the HUD with clicks, live, with no text editor and
no repository, and **share or import a whole look as one file** (the r/unixporn
loop). This closes the gap Kimani named: "I don't want users needing the
repository / VS Code to get this level of customization."

## Why now — the current panel is broken (Image #4 evidence)

`SettingsPanel.tsx` today is a fixed `width: 460` modal holding a flat stack of
tiny-labeled rows. Concrete defects visible in the user's screenshot:

- **THEME row clips** (`SettingsPanel.tsx:77`): the theme buttons use the plain
  `row` style with **no `flexWrap`**, so ~9 themes overflow the 460px width and
  are cut off on the left/right. (SCENES wraps; THEME does not.)
- **No structure:** every control is a 7px-pixel-label row in one long column;
  inconsistent primitives (○/● toggles, −/+ steppers, bare buttons); too narrow
  for its content; the old SIZE steppers overflowed into a bare `+` stack.
- **D's zones are unmanageable from Settings:** the LAYOUT row is a hint string
  only (`:170`). You can only rearrange by dragging or hand-editing JSON.
- **Missing controls:** busy/nap scene, density, fonts, per-zone width, flex
  zone, module on/off, and any share/import — all JSON-only or absent.

## Architecture

### 1. Shell — a tabbed panel (kills the clipping)

Rewrite `SettingsPanel` into a shell: a header with **pixel-styled tab buttons**,
a **scrollable body** rendering the active tab, sized `width: min(640px, 92vw)`,
`maxHeight: 86vh`. Tabs:

| Tab | Holds |
|---|---|
| **Appearance** | theme chips (wrapping), density, fonts, frame critters, audio |
| **Layout** | the zone manager (per-zone cards) + module on/off |
| **Scenes** | rotation checklist, speed, busy/nap pickers |
| **Sprites** | the existing Sprite Studio (rehomed unchanged) |
| **Share** | export / import a rice file |

Tab state is local `useState` (`'appearance'` default). Each tab is its own
component in `settings/` so no file is large or does two jobs.

### 2. Primitives — one consistent control vocabulary

New `settings/primitives.tsx` exporting small, styled building blocks used by
every tab, so controls stop being ad-hoc:

- `Section({ title, children })` — a labeled group with a dotted divider.
- `Row({ label, children })` — a fixed-width label + control area (wraps).
- `Stepper({ value, suffix, onDec, onInc })` — the −/value/+ control.
- `Toggle({ on, label, onClick })` — the ○/● button.
- `Chips({ items, active, onPick })` — a **wrapping** button group (this is what
  the THEME row becomes; `flexWrap: 'wrap'` so it never clips).
- `Picker({ value, options, onPick })` — a small dropdown (`<select>` styled) for
  busy/nap scene and fonts.

### 3. Layout tab — the visual zone manager (D's payoff)

Reads `resolveLayout(snap.ui.layout, VALID_IDS)` and
`resolveGeometry(snap.ui.geometry, zones.length, coreZone)` (both already exist
from D). Renders one **card per zone**, left-to-right, each showing:

- the modules currently in the zone (as chips), each with a **move-to-zone**
  `Picker` (choose another zone index) and reorder up/down;
- a **width `Stepper`** (writes `geometry.zoneWidths[i]`, clamped to
  `GEOMETRY_BOUNDS.zoneWidth`);
- a **"flex" `Toggle`** (radio semantics — sets `geometry.flexZone = i`; the flex
  zone's width stepper is disabled/greyed since it soaks slack);
- **remove-zone** (disabled when only one zone remains).

Above the cards: an **add-zone** button and a **module on/off** list toggling
`config.ui.modules[id].enabled` for every registered module (so you can hide a
panel entirely without dragging it out). Every write spreads the current slice
(`{ ...snap.ui.geometry, … }` / rebuilt `zones`) — the shallow-merge caveat from
B/C/D. All the layout maths (zone add/remove/width/flex) reuse the exact same
resolver-backed rules as the drag path, so Settings and drag stay consistent.

### 4. Scenes + Appearance — close the JSON-only gaps

- **Scenes tab:** existing rotation checklist + speed stepper, **plus** busy and
  nap `Picker`s over all scene names (`SCENE_REGISTRY` keys) writing
  `scenes.busy` / `scenes.nap`.
- **Appearance tab:** theme `Chips` (wrapping), **density** `Chips`
  (compact/cozy/airy → writes the active *user* theme's `density` when it's an
  editable user theme; for a built-in, density is read-only with a note), a
  **font** `Picker` for mono/pixel from a small curated list, frame toggle,
  audio mode + volume. (Font/density edits apply to user themes via
  `ui.themes[name]`; built-ins are immutable.)

### 5. Share tab — export / import a rice (no new IPC)

A **rice bundle** is one self-contained JSON describing a whole look:

```ts
// shared/types.ts
export interface RiceBundle {
  v: 1
  ui: UiConfig                       // theme, parade, layout, audio, modules, scenes, geometry
  themes?: Record<string, ThemeDef>  // embedded defs so the recipient needs no theme files
  sprites?: CustomSprite[]
}
```

**Key insight — this needs zero new main-process code.** User themes already
hot-load from `config.ui.themes` (inline) merged with the folder, and
`updateConfig` + `saveSprite` already exist. So:

- **Export** (`buildRice(snap): RiceBundle`, pure): `ui = snap.ui`;
  `themes` = the referenced user theme defs pulled from `snap.userThemes` (at
  minimum the active theme, plus any others in `snap.userThemes` so the library
  travels); `sprites = snap.sprites`. The Share tab offers **copy to clipboard**
  and **download `.rice.json`** (a Blob + anchor, renderer-only).
- **Import** (`parseRice(text): RiceBundle | { error }`, pure + validated):
  paste text or pick a file; on valid parse, apply through existing IPC:
  `updateConfig({ ui: { ...bundle.ui, themes: { ...(snap.ui.themes ?? {}), ...(bundle.themes ?? {}) } } })`
  (embeds their themes inline so they hot-load and merge into the user's
  library), then `saveSprite(s)` for each `bundle.sprites`. One paste → the HUD
  *becomes* their setup, live, no restart.

`lib/rice.ts` is pure and unit-tested: `buildRice` round-trips through
`parseRice`; `parseRice` is fail-soft (bad JSON, wrong `v`, missing `ui`,
non-object → typed error, never throws); import never partially-applies a
malformed bundle.

## Files

| File | Change |
|---|---|
| `components/SettingsPanel.tsx` | Rewritten into the tabbed shell (tab state + tab switch); sizing fix. |
| `components/settings/primitives.tsx` | **New.** Section, Row, Stepper, Toggle, Chips, Picker. |
| `components/settings/AppearanceTab.tsx` | **New.** theme/density/fonts/frame/audio. |
| `components/settings/LayoutTab.tsx` | **New.** zone manager + module on/off. |
| `components/settings/ScenesTab.tsx` | **New.** rotation/speed/busy/nap. |
| `components/settings/SpritesTab.tsx` | **New.** the existing Sprite Studio + Repos, moved verbatim. |
| `components/settings/ShareTab.tsx` | **New.** export/import UI. |
| `lib/rice.ts` | **New, pure.** `buildRice`, `parseRice`, bundle validation. Unit-tested. |
| `shared/types.ts` | `RiceBundle`. |

Sprite crunch helpers (`crunch`, `SpritePreview`) move with the Sprite Studio
into `SpritesTab.tsx` (or a shared `settings/sprite.tsx`); no behavior change.

## Testing

- **`lib/rice.ts`** (TDD, pure): `buildRice(snap)` includes ui + active theme +
  sprites; `parseRice(buildRice(...))` round-trips; `parseRice` fail-soft on bad
  JSON / wrong `v` / missing `ui` / array / non-object → error, no throw; import
  never applies a partial bundle.
- **Primitives / tabs / shell** — canvas+DOM, verified manually in `npm run dev`
  (typecheck + build are the automated gate): no horizontal clipping at the
  smaller window widths; every tab switch renders; a zone-manager edit matches
  what dragging produces; export→import on a second look reproduces it; a
  malformed pasted bundle shows an error and changes nothing.

## Fail-soft & constraints

- Live-apply everywhere (no restart); every config write spreads the current
  slice (shallow-merge caveat).
- Import validates before applying; a bad bundle is inert.
- Built-in themes are immutable — density/font edits target user themes only.
- Branch `vaultfetch`; no `Co-Authored-By` trailer; do not merge (arc continues
  with E — per-panel sizing + the customizable **notch** — before the big merge).
- The notch is **out of scope here** (separate window); E adds its controls and
  surfaces them in this same shell.
