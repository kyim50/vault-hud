# V.A.U.L.T. customization architecture — and its first module, `vaultfetch`

Date: 2026-07-05
Surface: `src/renderer/src` (module system + panel) + `src/main` (config + snapshot)

## Part A — The vision: a modular, rice-able HUD

V.A.U.L.T. is becoming a HUD you customize the way you customize Linux: swap the
look and the structure without forking, driven by a config file you own and
share. Guiding principles (these bind every future customization spec):

- **Everything is a module.** Every unit — each panel, the Core scene, the HUD
  frame, notch/tray widgets — has an id and lives in a registry. Nothing is
  hardcoded into the layout.
- **Nothing is forced.** Every module is opt-in with a sane default. Out-of-box
  works; users can strip to essentials or load it up.
- **The user owns a rice file.** A single portable config (`~/.vault-hud/rice.json`,
  later a `themes/` folder) layered over defaults, controlling **theme**
  (palette, fonts, density), **structure** (regions, which modules appear where,
  order, size), and **module options** (each module's own settings).
- **Shareable & open.** The rice file is portable — publish yours, drop in
  someone else's, switch in Settings. Open-source; ships with example rices.

This spec does **not** build all of that. It builds the **first module
(`vaultfetch`)** and, with it, the **minimal module-config seam** that later
specs generalize. Vertical slice first.

## Part B — The module-config seam (established here, generalized later)

Formalize what already exists informally (the `PANELS` map + `ui.layout`) into a
small, explicit contract that new work targets:

```ts
// src/renderer/src/modules/types.ts
export interface HudModule<Opt = unknown> {
  id: string
  render: (snap: HudSnapshot, opts: Opt) => ReactNode
  defaults: Opt              // shipped defaults for this module's options
}
```

- A `MODULES: Record<string, HudModule>` registry replaces the ad-hoc `PANELS`
  map (existing panels register unchanged, each with `defaults: {}` for now).
- `config.ui.modules?: Record<string, { enabled?: boolean; options?: object }>`
  is added to `UiConfig` — the per-module slice of the rice file. Effective
  options = `{ ...module.defaults, ...riceOptions }`; a module renders only when
  `enabled !== false`. Layout order still comes from `ui.layout`.
- **This is the seam.** This spec wires exactly one module (`fetch`) through it
  end to end. Migrating Vitals/notch/etc. to expose real options, the theme
  engine, and the shareable rice-file loader are **separate follow-on specs**
  (Part E). Existing panels keep working with empty defaults.

## Part C — The first module: `vaultfetch`

A `neofetch`/`fastfetch`-style module: the mascot as block-glyph art beside live
"specs," a palette swatch row, and a rotating quote. A normal HTML/React panel in
the mono font, so box-drawing chars and glyphs render natively.

```
╭─ ◈ VAULTFETCH ─────────────────────────╮
│     ▟██▙        ▟██▙    kimani@vault    │
│    ▟████████████████▙   ─────────────   │
│    ██  ██      ██  ██    uptime   3h 12m │
│    ██████████████████    repos   6 · 2✗ │
│     ▜██████████████▛    tokens   ▓▓▓░░ 27% │
│       ▘▘  ▘▘  ▘▘ ▘▘      commits  45/30 ↑ │
│                        provider  anthropic│
│                          streak  ●●●●○ 4d │
│    ███ ███ ███ ███ ███ ███ ███ ███       │
│    "the vault is quiet today."          │
╰─────────────────────────────────────────╯
```

### vaultfetch module options (the user-controllable surface — proves the seam)

```ts
interface FetchOptions {
  lines: FetchLineId[]   // which spec lines, in order (user reorders/removes)
  showLogo: boolean
  showSwatches: boolean
  quoteRotateSec: number // 0 = static
}
// defaults: lines = ['uptime','repos','tokens','commits','provider','streak','mood']
```

`FetchLineId` ∈ `uptime | repos | tokens | commits | provider | streak | mood`.
The user drops/reorders lines, hides the logo or swatches, or freezes the quote —
all via the module's rice options. This is the concrete demonstration that a
module is not fixed.

### Pieces (small, one responsibility each)

1. **Mascot block-art — `src/renderer/src/lib/blockart.ts` (pure).** Renders a
   sprite matrix (the `PANDA` blob, chars `B/D/n/E/L/.`) into half-block art via
   the `chafa`/neofetch technique: `▀` with **fg = top pixel color, bg = bottom
   pixel color**, pairing two sprite rows per glyph row (14 rows → 7 glyph rows,
   correct aspect in the ~1:2 cell). `fg`/`bg` from `pandaColor`; transparent →
   `null` (panel background).
   ```ts
   export interface Cell { ch: string; fg: string | null; bg: string | null }
   export function spriteToHalfBlocks(matrix: string[], palette: PandaPalette): Cell[][]
   ```

2. **Spec lines — `src/renderer/src/lib/fetchLines.ts` (pure).** Maps
   `(snapshot, now, lineIds[])` → `{ id, label, value }[]`, emitting only the
   requested ids in order:
   - `uptime` — `fmtUptime(now - bootAt)` → `"3h 12m"` / `"12m"` / `"45s"`
   - `repos` — `${repos.length} · ${sumDirty}✗`
   - `tokens` — `bar(percent,5)` + `${percent}%` (label `cpu` + cores when
     `usage.mode === 'cpu'`)
   - `commits` — `${primary.value}/${primary.target} ↑`
   - `provider` — `usage.provider`
   - `streak` — `dots(done,total,5)` + `${done}d` (`done` =
     `directives.filter(d=>d.done).length`)
   - `mood` — `happy → focused`, `napping → napping 💤`
   Helpers `fmtUptime`, `bar(pct,width)` (`▓`/`░`), `dots(n,total,width)`
   (`●`/`○`) live here, each unit-tested.

3. **Palette swatches** — a row of `███` colored from the active theme's
   palette; doubles as a live theme preview once the palette engine lands.

4. **Rotating quote** — one line from `snapshot.quotes`, re-rolled every
   `quoteRotateSec` (default 20; 0 = static), random, no immediate repeat.

5. **`src/renderer/src/components/VaultfetchPanel.tsx`** — composes the four
   inside the standard `Panel` chrome (header `◈ VAULTFETCH`), reading its
   effective `FetchOptions`. Left = half-block mascot (`<span>`s carrying
   `color`/`background`); right = the `key   value` mono grid; swatches + quote
   below. Colors from existing theme constants/CSS vars so it recolors with the
   theme.

## Part D — Data: config + two snapshot fields

- `UiConfig` gains `modules?: Record<string, { enabled?: boolean; options?: object }>`
  (the per-module rice slice; `config.ts` merges it fail-soft like existing keys).
- `HudSnapshot` gains (both additive, populated in `src/main/state.ts`):
  - `bootAt: number` — `Date.now()` captured once at main startup (uptime source).
  - `quotes: string[]` — ~18 built-in defaults merged with lines from a
    `Quotes.md` in the vault (root or `dashboardFolder`) when present (list items
    or non-empty lines, surrounding `"` stripped). Pool =
    `[...vaultQuotes, ...defaults]` deduped; missing file → defaults only. Reuses
    the existing markdown read path, degrades silently.

## Part E — Roadmap (each its own later spec; NOT built here)

1. Migrate existing panels to real options (Vitals: choose metrics; Deck: choose
   commands; Core: choose scenes) on the same seam.
2. Theme/palette engine — user-defined palette + fonts recoloring the whole HUD,
   swatch row goes live.
3. Notch + tray as modules (choose tabs/widgets/quick-commands).
4. The shareable rice file/`themes/` folder + loader + Settings switcher +
   example rices (incl. a terminal/ANSI one).
5. More terminal-art: FIGlet headers, full ASCII/ANSI Core render mode,
   image→ASCII in Sprite Studio, user-swappable fetch logos.

## Testing

- `tests/blockart.test.ts` — glyph-row count = `ceil(rows/2)`, width preserved, a
  known pixel pair → `{ch:'▀', fg, bg}`, transparent → `null`.
- `tests/fetchLines.test.ts` — `fmtUptime` boundaries, `bar`/`dots` fill/width,
  `fetchLines` emits only requested ids in order over a fixture snapshot
  (dirty-sum, streak count, cpu-mode token label).
- `tests/config.test.ts` — extend: `ui.modules` merges fail-soft; unknown/absent
  keys don't throw; `enabled:false` respected.
- Quote merge — defaults-only when no file, file-lines merged when present, `"`
  stripped.
- Manual: `npm run dev` — panel renders logo/specs/swatches/rotating quote; drag
  between columns; set `ui.modules.fetch.options.lines` to a subset and confirm
  only those render; `enabled:false` hides it.

## Out of scope

Everything in Part E. This spec is the `vaultfetch` module + the minimal
module-config seam it rides on.
