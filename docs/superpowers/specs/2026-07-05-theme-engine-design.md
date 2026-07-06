# Theme Engine — user-authored, shareable themes that recolor the whole HUD

Date: 2026-07-05
Surface: `src/renderer/src/theme/` (new module) + `src/main` (themes folder loader) +
`src/renderer/src/components/CoreScene.tsx` (canvas color unification)

## Part A — Vision & place in the roadmap

Sub-project **A** of the customization architecture (see the vaultfetch spec, Part E).
The goal is Linux-style theming: a user is **not** limited to prebuilt themes — they
author their own from scratch as plain text files and share them. A theme is one
standalone file you can send someone; they drop it in a folder and it appears in their
HUD. Built-in themes exist only as always-available fallbacks and editable examples.

This is one of three independent sub-projects; the other two get their own specs:

| # | Sub-project | Makes customizable |
|---|-------------|--------------------|
| **A** | **Theme engine** (this spec) | Colors + fonts + density, recoloring panels + Core canvas + mascot, from user-authored theme files. |
| B | Core scene customization | Which scenes rotate, order, timing. |
| C | Resizing / geometry | Column widths, panel sizes, Core size. |

## Part B — The problem this solves: two unlinked color worlds

Colors live in two disconnected places today:

1. **HTML panels** read CSS custom properties (`--bg`, `--ink`, `--clay`, …) defined in
   `styles/theme.css` under `:root` and `body[data-theme='paper']`. The theme toggle
   just flips `document.body.dataset.theme`.
2. **The Core canvas** (`CoreScene.tsx`) uses **hardcoded JS constants** — `INK`,
   `BODY`, `BODY_LIGHT`, `EYE`, `GRAY` — plus the mascot's `DEFAULT_PALETTE` from
   `panda.ts`. These ignore the theme entirely: switch to paper and the Core stays the
   same colors.

The theme engine's core job is to **unify both worlds under one resolved theme**.

## Part C — Data model: a theme file

A theme is a JSON object; every field is optional.

```json
// ~/.vault-hud/themes/midnight.json
{
  "name": "midnight",
  "colors": { "bg": "#0d0f14", "ink": "#c8d0e0", "accent": "#6ea8ff", "mascotBody": "#d97757" },
  "fonts":  { "mono": "JetBrains Mono", "pixel": "Departure Mono" },
  "density": "cozy"
}
```

**Write little, override anything.** Authors supply a few core roles; the rest derive.
`name` defaults to the filename (`midnight.json` → `midnight`).

### Color roles (`ThemeColors`)

Commonly authored: `bg`, `ink`, `accent`, `mascotBody`.
Overridable but derived when omitted:

| Role | Derivation when omitted |
|------|-------------------------|
| `surface` (panel bg) | ← `bg` |
| `line` | ← `ink` |
| `lineSoft` (hairline) | ← `mix(ink, bg, 0.82)` (mostly bg) |
| `inkDim` | ← `mix(ink, bg, 0.45)` |
| `accent` | ← `ink` |
| `accentDim` | ← `mix(accent, bg, 0.45)` |
| `mascotBodyLight` | ← `lighten(mascotBody, 0.15)` |
| `mascotDark` | ← `darken(mascotBody, 0.15)` |
| `mascotEye` | ← `#17160f` |
| `mascotMuzzle` | ← `#f4f2e9` |
| `danger` | ← `#ff6e4e` |

`resolve(partial) → ResolvedTheme` fills every role, so downstream code always sees a
complete palette.

### Fonts (`ThemeFonts`)
`{ mono?, pixel? }`. Each value becomes the **first family in the stack**, with the
existing fallbacks appended (`'<value>', 'Departure Mono', 'SF Mono', Menlo, monospace`).
A bundled name, an installed system font, or a fallback all work.

### Density
`'compact' | 'cozy' | 'airy'` → spacing scale:

| density | `--pad-x`/`--pad-y` | `--gap` |
|---------|---------------------|---------|
| compact | 8 / 6 | 3 |
| cozy (default, = today) | 10 / 8 | 5 |
| airy | 14 / 12 | 8 |

## Part D — Architecture: one resolved theme drives both worlds

`applyTheme(resolved)`:

1. **HTML panels** — writes CSS custom properties on `document.documentElement`:
   `--bg`←bg, `--panel`←surface, `--line`←line, `--line-soft`←lineSoft,
   `--ink`←ink, `--ink-dim`←inkDim, `--accent`←accent, `--accent-dim`←accentDim,
   `--clay`←mascotBody, `--danger`←danger, `--font-mono`/`--font-pixel`←font stacks,
   `--pad-x`/`--pad-y`/`--gap`←density. Panels already read these, so they recolor for
   free. `theme.css` panel rules change from fixed `padding: 8px 10px; gap: 5px` to
   `padding: var(--pad-y) var(--pad-x); gap: var(--gap)`.
2. **Core canvas** — updates a shared **`sceneColors`** object (module singleton) that
   `CoreScene.tsx` reads from. Today's constants become fields:
   `INK`→`sceneColors.ink`, `BODY`→`sceneColors.body`, `BODY_LIGHT`→`sceneColors.bodyLight`,
   `EYE`→`sceneColors.eye`, `GRAY`→`sceneColors.gray`. The mascot palette passed to
   `drawPanda` becomes `{ body: mascotBody, dark: mascotDark, ink, eye: mascotEye,
   muzzle: mascotMuzzle }` from the resolved theme instead of the imported
   `DEFAULT_PALETTE`. `sceneColors` is refreshed **once per theme change**, not per
   frame — no `getComputedStyle` in the render loop.

This mechanical constant-swap across `CoreScene.tsx` is the one non-trivial refactor and
is what finally makes the canvas obey the theme.

Result: change theme → panels **and** Core + mascot recolor together.

## Part E — The drop-in themes folder (the shareable surface)

- **Location:** `~/.vault-hud/themes/*.json`. Each file is one theme.
- **Load:** on startup the main process reads every `*.json` in the folder into a
  `Record<name, ThemeDef>` (invalid/unparseable files are skipped with a warning, never
  fatal). Reuses the existing `~/.vault-hud` read path.
- **Hot reload:** `fs.watch` the folder (mirroring the vault markdown watch in
  `src/main`); on change, rebuild the map and push a fresh snapshot → the picker and the
  active theme update live.
- **First-run scaffold:** if `themes/` does not exist, create it and write `midnight.json`
  + `amber.json` as editable example files (a cool-blue and an amber-CRT look). These are
  starter dotfiles — users copy, edit, or delete them freely.
- **Built-in fallbacks:** `terminal` and `paper` live in code (`builtins.ts`), always
  available, cannot be deleted. They are reframed as full theme objects (colors + fonts +
  density) — zero visual change, just restructured from the current CSS.
- **Precedence / merge:** `availableThemes = { ...builtins, ...config.ui.themes,
  ...folderThemes }` — a folder file named `terminal` overrides the built-in. Active
  theme = `ui.theme`; if the name is missing, fall back to `terminal`.

Inline `ui.themes` in `config.json` is still supported (copy-paste sharing), but the
folder is the primary, first-class surface.

## Part F — Settings picker & live swatch

- **Picker:** a theme dropdown in `SettingsPanel` listing `Object.keys(availableThemes)`;
  selecting one writes `config.ui.theme`. No file editing needed to switch — the built-in
  toggle is replaced by this.
- **Live swatch row:** vaultfetch's hardcoded `SWATCHES` (`VaultfetchPanel.tsx`) starts
  reading the **active resolved theme's** roles, so it becomes a real palette preview —
  closing the loop from the first module.

## Part G — Data flow (main → renderer)

- `config.ts` — `UiConfig.theme` widens from `'terminal' | 'paper'` to `string`;
  add `UiConfig.themes?: Record<string, ThemeDef>` (inline themes), merged fail-soft like
  existing keys.
- Main loads `themes/` folder, merges with `config.ui.themes`, and sends the combined map
  on the snapshot: `HudSnapshot.userThemes: Record<string, ThemeDef>`.
- Renderer combines `builtins` + `userThemes`, resolves the active theme, and calls
  `applyTheme` on mount and whenever `ui.theme` / `userThemes` change (replacing the
  current `document.body.dataset.theme` effect in `App.tsx`).

## Part H — Files & modules

New renderer `theme/` module, each file single-purpose:

| File | Purpose |
|------|---------|
| `theme/roles.ts` | `ThemeColors` / `ThemeFonts` / `ThemeDef` / `ResolvedTheme` types + role defaults |
| `theme/color.ts` | Pure hex helpers: `parseHex`, `mix`, `lighten`, `darken` |
| `theme/resolve.ts` | `resolve(partial) → ResolvedTheme` (derivation) |
| `theme/builtins.ts` | `terminal`, `paper` full theme objects |
| `theme/apply.ts` | `applyTheme(resolved)`: CSS vars + fonts + density → root |
| `theme/sceneColors.ts` | Canvas bridge singleton the Core reads from |

Shared: `ThemeDef` type added to `src/shared/types.ts` (so main + renderer agree).
Bundled fonts: `@font-face` for the current Departure Mono + Press Start 2P, plus 1–2
terminal faces (e.g. JetBrains Mono), declared in `theme.css`, assets in the renderer.

## Part I — Testing

- `color.ts` — TDD: `parseHex` round-trips, `mix`/`lighten`/`darken` produce expected
  values at boundaries (0, 1, mid), invalid hex handled.
- `resolve.ts` — TDD: a partial (only `bg`/`ink`/`accent`/`mascotBody`) fills every role;
  explicit overrides win over derivation; a full theme resolves to itself.
- `builtins.ts` — `terminal`/`paper` resolve without error and match the current CSS
  values (regression guard: the reframe changes nothing visually).
- `config.ts` — extend: widened `theme` string + `themes` map merge fail-soft; unknown
  keys don't throw.
- Folder loader (main) — parses valid files, skips invalid ones without crashing,
  filename→name fallback.
- Manual: `npm run dev` — switch themes in Settings and confirm **panels + Core + mascot**
  all recolor; drop a new `themes/foo.json` in and confirm it hot-loads into the picker;
  set density and confirm panel spacing changes; set a bundled + a system font.

## Out of scope (later specs)

- Sub-projects B (scene customization) and C (resizing).
- In-app theme **editor** / color pickers (authoring is via files for now).
- A community **gallery** / import-from-URL (part of the later shareable-rice-file work).
- Theming the **canvas bitmap font** (`pixelfont.ts` is hand-drawn, not a CSS font) —
  font themes restyle HTML panels only; documented, not built.
- Per-panel color overrides.
