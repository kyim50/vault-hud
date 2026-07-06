# Theme Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One user-authored, shareable theme (colors + fonts + density) recolors the entire HUD — HTML panels *and* the Core canvas + mascot — loaded from `~/.vault-hud/themes/*.json`.

**Architecture:** A pure `theme/` module in the renderer resolves a partial `ThemeDef` into a full `ResolvedTheme`, then `applyTheme` writes CSS custom properties to the document root (panels recolor for free) while `setSceneColors` updates a singleton the Core canvas reads from (unifying the two color worlds). The main process loads/scaffolds/watches a `themes/` folder and ships the theme map on the snapshot.

**Tech Stack:** TypeScript, React 19, Electron, Vitest (`environment: 'node'` — pure logic is unit-tested; DOM/canvas is verified manually in `npm run dev`).

## Global Constraints

- **No Claude co-author trailer in any commit** (repo-wide rule). Commit messages end at their own body — do not add `Co-Authored-By`.
- **Branch:** all work lands on the existing `vaultfetch` branch (do not create a new branch, do not merge).
- **Test env is `node`** (`vitest.config.ts`): only pure modules get unit tests. Modules touching `document`/canvas are verified manually — do not add jsdom.
- **Fail-soft config:** malformed user input (bad JSON, wrong shape) must never crash — skip and fall back, mirroring `collectQuotes`/`mergeConfig`.
- **No new bundled fonts:** theme font values are placed at the front of the existing CSS stack; the two bundled faces (`Departure Mono`, `Press Start 2P`) remain the fallbacks.
- **Verify before commit:** `npm test` and `npm run typecheck` green before each commit.

---

## File Structure

**Create (renderer `theme/` module):**
- `src/renderer/src/theme/color.ts` — pure hex helpers
- `src/renderer/src/theme/roles.ts` — role/density/font defaults + `ResolvedTheme` type
- `src/renderer/src/theme/resolve.ts` — `resolve(ThemeDef) → ResolvedTheme`
- `src/renderer/src/theme/builtins.ts` — `terminal` + `paper`
- `src/renderer/src/theme/apply.ts` — CSS-var writer + `getActiveTheme`
- `src/renderer/src/theme/sceneColors.ts` — canvas bridge singleton

**Create (main):**
- `src/main/collectors/themes.ts` — folder loader/scaffold/merge (mirrors `collectors/quotes.ts`)

**Create (tests):**
- `tests/color.test.ts`, `tests/resolve.test.ts`, `tests/builtins.test.ts`, `tests/themes.test.ts`

**Modify:**
- `src/shared/types.ts` — `ThemeDef` types; widen `UiConfig.theme`; add `UiConfig.themes`, `HudSnapshot.userThemes`
- `src/main/state.ts` — populate `userThemes`, watch the themes folder
- `src/renderer/src/styles/theme.css` — density/spacing vars on panels; drop `data-theme` paper block
- `src/renderer/src/components/CoreScene.tsx` — swap the 5 color constants (68 usages) + `PAL` for the `sceneColors` singleton
- `src/renderer/src/hud/App.tsx` — resolve+apply the active theme (replaces the `dataset.theme` effect)
- `src/renderer/src/components/SettingsPanel.tsx` — theme picker over all available themes
- `src/renderer/src/components/VaultfetchPanel.tsx` — swatches read the active resolved theme

---

## Task 1: Color math utility

**Files:**
- Create: `src/renderer/src/theme/color.ts`
- Test: `tests/color.test.ts`

**Interfaces:**
- Produces: `parseHex(hex: string): [number, number, number]`, `toHex(rgb: [number, number, number]): string`, `mix(a: string, b: string, t: number): string`, `lighten(hex: string, amount: number): string`, `darken(hex: string, amount: number): string`

- [ ] **Step 1: Write the failing test**

```ts
// tests/color.test.ts
import { describe, it, expect } from 'vitest'
import { parseHex, toHex, mix, lighten, darken } from '../src/renderer/src/theme/color'

describe('color', () => {
  it('parses 6-digit and 3-digit hex', () => {
    expect(parseHex('#d97757')).toEqual([217, 119, 87])
    expect(parseHex('#fff')).toEqual([255, 255, 255])
  })
  it('round-trips through toHex', () => {
    expect(toHex([217, 119, 87])).toBe('#d97757')
    expect(toHex([0, 0, 0])).toBe('#000000')
  })
  it('mix(t=0) is a, mix(t=1) is b, mix(0.5) is midpoint', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
  it('lighten moves toward white, darken toward black', () => {
    expect(lighten('#808080', 1)).toBe('#ffffff')
    expect(darken('#808080', 1)).toBe('#000000')
  })
  it('tolerates missing # and clamps out-of-range t', () => {
    expect(parseHex('d97757')).toEqual([217, 119, 87])
    expect(mix('#000000', '#ffffff', 2)).toBe('#ffffff')
    expect(mix('#000000', '#ffffff', -1)).toBe('#000000')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/color.test.ts`
Expected: FAIL — cannot find module `color`.

- [ ] **Step 3: Write the implementation**

```ts
// src/renderer/src/theme/color.ts
export type RGB = [number, number, number]

export function parseHex(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function toHex(rgb: RGB): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

// t clamped to [0,1]; t=0 → a, t=1 → b
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const ca = parseHex(a)
  const cb = parseHex(b)
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * k) as unknown as RGB)
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, '#ffffff', amount)
}

export function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/color.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/color.test.ts src/renderer/src/theme/color.ts
git commit -m "feat: theme color math helpers (mix/lighten/darken)"
```

---

## Task 2: Theme types + resolve

**Files:**
- Modify: `src/shared/types.ts` (add theme types; widen `UiConfig.theme`; add `UiConfig.themes` + `HudSnapshot.userThemes`)
- Create: `src/renderer/src/theme/roles.ts`
- Create: `src/renderer/src/theme/resolve.ts`
- Test: `tests/resolve.test.ts`

**Interfaces:**
- Consumes: `mix`, `lighten`, `darken` from `theme/color`
- Produces:
  - (shared) `Density = 'compact' | 'cozy' | 'airy'`; `ThemeColors` (all optional string roles); `ThemeFonts = { mono?: string; pixel?: string }`; `ThemeDef = { name?: string; colors?: ThemeColors; fonts?: ThemeFonts; density?: Density }`
  - (roles) `ResolvedColors` (all roles required), `ResolvedTheme = { colors: ResolvedColors; fonts: { mono: string; pixel: string }; density: Density; spacing: { padX: number; padY: number; gap: number } }`, `DENSITY_SPACING`, `FONT_FALLBACK`
  - (resolve) `resolve(def: ThemeDef): ResolvedTheme`

- [ ] **Step 1: Add shared types**

In `src/shared/types.ts`, add near `ModuleConfig`:

```ts
export type Density = 'compact' | 'cozy' | 'airy'
export interface ThemeColors {
  bg?: string
  surface?: string
  ink?: string
  inkDim?: string
  line?: string
  lineSoft?: string
  accent?: string
  accentDim?: string
  mascotBody?: string
  mascotBodyLight?: string
  mascotDark?: string
  mascotEye?: string
  mascotMuzzle?: string
  danger?: string
}
export interface ThemeFonts {
  mono?: string
  pixel?: string
}
export interface ThemeDef {
  name?: string
  colors?: ThemeColors
  fonts?: ThemeFonts
  density?: Density
}
```

Change `UiConfig.theme` from `'terminal' | 'paper'` to `string`, and add `themes`:

```ts
export interface UiConfig {
  theme: string // active theme name: a built-in or a user theme
  parade: boolean
  layout?: PanelLayout
  audio?: AudioConfig
  modules?: Record<string, ModuleConfig>
  themes?: Record<string, ThemeDef> // inline user themes (folder themes merge over these)
}
```

Add to `HudSnapshot` (after `quotes`):

```ts
  userThemes: Record<string, ThemeDef> // config.ui.themes merged with ~/.vault-hud/themes/*.json
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/resolve.test.ts
import { describe, it, expect } from 'vitest'
import { resolve } from '../src/renderer/src/theme/resolve'

describe('resolve', () => {
  it('fills every role from a minimal theme', () => {
    const r = resolve({ colors: { bg: '#0d0f14', ink: '#c8d0e0', accent: '#6ea8ff', mascotBody: '#d97757' } })
    expect(r.colors.bg).toBe('#0d0f14')
    expect(r.colors.surface).toBe('#0d0f14') // ← bg
    expect(r.colors.accent).toBe('#6ea8ff')
    expect(r.colors.mascotEye).toBe('#17160f') // role default
    expect(r.colors.mascotMuzzle).toBe('#f4f2e9')
    expect(r.colors.danger).toBe('#ff6e4e')
    // derived roles are non-empty valid hex
    expect(r.colors.inkDim).toMatch(/^#[0-9a-f]{6}$/)
    expect(r.colors.lineSoft).toMatch(/^#[0-9a-f]{6}$/)
    expect(r.colors.mascotDark).toMatch(/^#[0-9a-f]{6}$/)
    expect(r.colors.mascotBodyLight).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('explicit overrides win over derivation', () => {
    const r = resolve({ colors: { ink: '#ffffff', bg: '#000000', inkDim: '#123456', accent: '#abcdef', accentDim: '#fedcba' } })
    expect(r.colors.inkDim).toBe('#123456')
    expect(r.colors.accent).toBe('#abcdef')
    expect(r.colors.accentDim).toBe('#fedcba')
  })
  it('defaults density to cozy and maps spacing', () => {
    expect(resolve({}).density).toBe('cozy')
    expect(resolve({}).spacing).toEqual({ padX: 10, padY: 8, gap: 5 })
    expect(resolve({ density: 'airy' }).spacing).toEqual({ padX: 14, padY: 12, gap: 8 })
  })
  it('prepends a named font to the fallback stack', () => {
    expect(resolve({ fonts: { mono: 'JetBrains Mono' } }).fonts.mono).toContain("'JetBrains Mono'")
    expect(resolve({ fonts: { mono: 'JetBrains Mono' } }).fonts.mono).toContain('Menlo')
    expect(resolve({}).fonts.mono).toContain('Departure Mono')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/resolve.test.ts`
Expected: FAIL — cannot find module `resolve`.

- [ ] **Step 4: Write `roles.ts`**

```ts
// src/renderer/src/theme/roles.ts
import type { Density } from '@shared/types'

export interface ResolvedColors {
  bg: string
  surface: string
  ink: string
  inkDim: string
  line: string
  lineSoft: string
  accent: string
  accentDim: string
  mascotBody: string
  mascotBodyLight: string
  mascotDark: string
  mascotEye: string
  mascotMuzzle: string
  danger: string
}
export interface ResolvedTheme {
  colors: ResolvedColors
  fonts: { mono: string; pixel: string }
  density: Density
  spacing: { padX: number; padY: number; gap: number }
}

// terminal-theme values are the ultimate fallback when even core roles are omitted
export const BASE = { bg: '#1e1e1e', ink: '#e8e6e3', mascotBody: '#d97757' }
export const ROLE_DEFAULTS = { mascotEye: '#17160f', mascotMuzzle: '#f4f2e9', danger: '#ff6e4e' }
export const DENSITY_SPACING: Record<Density, { padX: number; padY: number; gap: number }> = {
  compact: { padX: 8, padY: 6, gap: 3 },
  cozy: { padX: 10, padY: 8, gap: 5 },
  airy: { padX: 14, padY: 12, gap: 8 }
}
export const FONT_FALLBACK = {
  mono: "'Departure Mono', 'SF Mono', Menlo, monospace",
  pixel: "'Press Start 2P', monospace"
}
```

- [ ] **Step 5: Write `resolve.ts`**

```ts
// src/renderer/src/theme/resolve.ts
import type { ThemeDef } from '@shared/types'
import { mix, lighten, darken } from './color'
import { BASE, ROLE_DEFAULTS, DENSITY_SPACING, FONT_FALLBACK, type ResolvedTheme } from './roles'

export function resolve(def: ThemeDef): ResolvedTheme {
  const c = def.colors ?? {}
  const bg = c.bg ?? BASE.bg
  const ink = c.ink ?? BASE.ink
  const accent = c.accent ?? ink
  const mascotBody = c.mascotBody ?? BASE.mascotBody
  const density = def.density ?? 'cozy'
  const stack = (name: string | undefined, fallback: string) => (name ? `'${name}', ${fallback}` : fallback)
  return {
    colors: {
      bg,
      surface: c.surface ?? bg,
      ink,
      inkDim: c.inkDim ?? mix(ink, bg, 0.45),
      line: c.line ?? ink,
      lineSoft: c.lineSoft ?? mix(ink, bg, 0.82),
      accent,
      accentDim: c.accentDim ?? mix(accent, bg, 0.45),
      mascotBody,
      mascotBodyLight: c.mascotBodyLight ?? lighten(mascotBody, 0.15),
      mascotDark: c.mascotDark ?? darken(mascotBody, 0.15),
      mascotEye: c.mascotEye ?? ROLE_DEFAULTS.mascotEye,
      mascotMuzzle: c.mascotMuzzle ?? ROLE_DEFAULTS.mascotMuzzle,
      danger: c.danger ?? ROLE_DEFAULTS.danger
    },
    fonts: { mono: stack(def.fonts?.mono, FONT_FALLBACK.mono), pixel: stack(def.fonts?.pixel, FONT_FALLBACK.pixel) },
    density,
    spacing: DENSITY_SPACING[density]
  }
}
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run tests/resolve.test.ts && npm run typecheck`
Expected: resolve tests PASS. Typecheck may surface `UiConfig.theme` narrowing errors in `SettingsPanel.tsx` (the `as const` map) — if so, that file is fixed in Task 8; for now confirm no errors *other* than that. If the only errors are in `SettingsPanel.tsx`, proceed.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/renderer/src/theme/roles.ts src/renderer/src/theme/resolve.ts tests/resolve.test.ts
git commit -m "feat: theme types + resolve (partial ThemeDef → full ResolvedTheme)"
```

---

## Task 3: Built-in themes (regression guard)

**Files:**
- Create: `src/renderer/src/theme/builtins.ts`
- Test: `tests/builtins.test.ts`

**Interfaces:**
- Consumes: `resolve` from `theme/resolve`; `ThemeDef` from `@shared/types`
- Produces: `BUILTINS: Record<string, ThemeDef>` (keys `terminal`, `paper`)

- [ ] **Step 1: Write the failing test** (locks current CSS values so the reframe changes nothing)

```ts
// tests/builtins.test.ts
import { describe, it, expect } from 'vitest'
import { BUILTINS } from '../src/renderer/src/theme/builtins'
import { resolve } from '../src/renderer/src/theme/resolve'

describe('builtins', () => {
  it('terminal resolves to the current terminal CSS values', () => {
    const t = resolve(BUILTINS.terminal).colors
    expect(t.bg).toBe('#1e1e1e')
    expect(t.surface).toBe('#1e1e1e')
    expect(t.ink).toBe('#e8e6e3')
    expect(t.inkDim).toBe('#8f8f8f')
    expect(t.lineSoft).toBe('#3a3a3a')
    expect(t.mascotBody).toBe('#d97757')
    expect(t.mascotDark).toBe('#b85c3f')
    expect(t.mascotBodyLight).toBe('#e8a284')
  })
  it('paper resolves to the current paper CSS values', () => {
    const p = resolve(BUILTINS.paper).colors
    expect(p.bg).toBe('#f4f2e9')
    expect(p.ink).toBe('#17160f')
    expect(p.inkDim).toBe('#8d8a7a')
    expect(p.lineSoft).toBe('#dcd9ca')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/builtins.test.ts`
Expected: FAIL — cannot find module `builtins`.

- [ ] **Step 3: Write `builtins.ts`** (explicit values preserve the hand-picked canvas colors like `mascotBodyLight`)

```ts
// src/renderer/src/theme/builtins.ts
import type { ThemeDef } from '@shared/types'

export const BUILTINS: Record<string, ThemeDef> = {
  terminal: {
    name: 'terminal',
    colors: {
      bg: '#1e1e1e',
      surface: '#1e1e1e',
      ink: '#e8e6e3',
      inkDim: '#8f8f8f',
      lineSoft: '#3a3a3a',
      accent: '#e8e6e3',
      mascotBody: '#d97757',
      mascotDark: '#b85c3f',
      mascotBodyLight: '#e8a284',
      mascotEye: '#17160f',
      mascotMuzzle: '#f4f2e9',
      danger: '#ff6e4e'
    },
    density: 'cozy'
  },
  paper: {
    name: 'paper',
    colors: {
      bg: '#f4f2e9',
      surface: '#f4f2e9',
      ink: '#17160f',
      inkDim: '#8d8a7a',
      lineSoft: '#dcd9ca',
      accent: '#17160f',
      mascotBody: '#d97757'
    },
    density: 'cozy'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/builtins.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/theme/builtins.ts tests/builtins.test.ts
git commit -m "feat: built-in terminal + paper themes (regression-locked to current CSS)"
```

---

## Task 4: Apply (CSS vars) + sceneColors bridge + CSS spacing vars

**Files:**
- Create: `src/renderer/src/theme/apply.ts`
- Create: `src/renderer/src/theme/sceneColors.ts`
- Modify: `src/renderer/src/styles/theme.css` (panels use spacing vars; drop the `data-theme` paper block)

**Interfaces:**
- Consumes: `ResolvedTheme` from `theme/roles`
- Produces: `applyTheme(t: ResolvedTheme): void`, `getActiveTheme(): ResolvedTheme | null` (apply.ts); `sceneColors` (mutable object with `ink, body, bodyLight, eye, gray, dark`), `scenePalette` (mutable `{ body, dark, ink, eye, muzzle }`), `setSceneColors(t: ResolvedTheme): void` (sceneColors.ts)

*(No unit test — these touch `document`/are consumed by canvas; verified manually in Task 7. Keep logic thin.)*

- [ ] **Step 1: Write `sceneColors.ts`**

```ts
// src/renderer/src/theme/sceneColors.ts
import type { ResolvedTheme } from './roles'

// Live singletons the Core canvas reads every frame; updated once per theme change.
export const sceneColors = {
  ink: '#e8e6e3',
  body: '#d97757',
  bodyLight: '#e8a284',
  eye: '#17160f',
  gray: '#8f8f8f',
  dark: '#b85c3f'
}
export const scenePalette = { body: '#d97757', dark: '#b85c3f', ink: '#e8e6e3', eye: '#17160f', muzzle: '#f4f2e9' }

export function setSceneColors(t: ResolvedTheme): void {
  const c = t.colors
  sceneColors.ink = c.ink
  sceneColors.body = c.mascotBody
  sceneColors.bodyLight = c.mascotBodyLight
  sceneColors.eye = c.mascotEye
  sceneColors.gray = c.inkDim
  sceneColors.dark = c.mascotDark
  scenePalette.body = c.mascotBody
  scenePalette.dark = c.mascotDark
  scenePalette.ink = c.ink
  scenePalette.eye = c.mascotEye
  scenePalette.muzzle = c.mascotMuzzle
}
```

- [ ] **Step 2: Write `apply.ts`**

```ts
// src/renderer/src/theme/apply.ts
import type { ResolvedTheme } from './roles'

let active: ResolvedTheme | null = null
export function getActiveTheme(): ResolvedTheme | null {
  return active
}

// Inline custom properties on <html> override the :root defaults in theme.css.
export function applyTheme(t: ResolvedTheme): void {
  active = t
  const s = document.documentElement.style
  const c = t.colors
  s.setProperty('--bg', c.bg)
  s.setProperty('--panel', c.surface)
  s.setProperty('--line', c.line)
  s.setProperty('--line-soft', c.lineSoft)
  s.setProperty('--ink', c.ink)
  s.setProperty('--ink-dim', c.inkDim)
  s.setProperty('--accent', c.accent)
  s.setProperty('--accent-dim', c.accentDim)
  s.setProperty('--clay', c.mascotBody)
  s.setProperty('--danger', c.danger)
  s.setProperty('--font-mono', t.fonts.mono)
  s.setProperty('--font-pixel', t.fonts.pixel)
  s.setProperty('--pad-x', `${t.spacing.padX}px`)
  s.setProperty('--pad-y', `${t.spacing.padY}px`)
  s.setProperty('--gap', `${t.spacing.gap}px`)
}
```

- [ ] **Step 3: Update `theme.css`** — add spacing defaults to `:root`, switch panels to vars, delete the paper block.

In the `:root { … }` block, add three lines (cozy defaults, so first paint before JS matches today):

```css
  --pad-x: 10px;
  --pad-y: 8px;
  --gap: 5px;
```

Change the `.panel` rule's `padding: 8px 10px;` and `gap: 5px;` to:

```css
  padding: var(--pad-y) var(--pad-x);
  gap: var(--gap);
```

Delete the entire `body[data-theme='paper'] { … }` block (paper is now a built-in applied via `applyTheme`).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no NEW errors from these files (pre-existing `SettingsPanel.tsx` narrowing error from Task 2 may remain until Task 8).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/theme/apply.ts src/renderer/src/theme/sceneColors.ts src/renderer/src/styles/theme.css
git commit -m "feat: applyTheme CSS-var writer + sceneColors canvas bridge + density spacing vars"
```

---

## Task 5: Unify the Core canvas onto sceneColors

**Files:**
- Modify: `src/renderer/src/components/CoreScene.tsx`

**Interfaces:**
- Consumes: `sceneColors`, `scenePalette` from `theme/sceneColors`

*(Manual/visual verification — canvas rendering. No unit test.)*

- [ ] **Step 1: Replace the color imports/constants**

At the top of `CoreScene.tsx`, change the panda import to drop `DEFAULT_PALETTE as PAL` and add the sceneColors import:

```ts
import { PANDA, PANDA_BODY_ROWS, PANDA_BUDDY, drawPanda } from '../lib/panda'
import { sceneColors, scenePalette } from '../theme/sceneColors'
```

Delete the five module constants:

```ts
const INK = '#e8e6e3'
const BODY = '#d97757'
const BODY_LIGHT = '#e8a284'
const EYE = '#17160f'
const GRAY = '#9a9a9a'
```

- [ ] **Step 2: Rewrite the references (mechanical, all 68 usages)**

Replace every identifier throughout the file:
- `INK` → `sceneColors.ink`
- `BODY_LIGHT` → `sceneColors.bodyLight` (do this BEFORE `BODY` to avoid partial matches)
- `BODY` → `sceneColors.body`
- `EYE` → `sceneColors.eye`
- `GRAY` → `sceneColors.gray`
- `PAL` → `scenePalette` (e.g. `PAL.dark` → `scenePalette.dark`, and the `drawPanda(..., PAL, ...)` calls → `scenePalette`)

Do this with care (e.g. editor replace, then read the diff). Guardrail after: `grep -nE '\b(INK|BODY|BODY_LIGHT|EYE|GRAY|PAL)\b' src/renderer/src/components/CoreScene.tsx` must return **nothing**.

- [ ] **Step 3: Verify no stale references + typecheck + build**

Run:
```bash
grep -nE '\b(INK|BODY|BODY_LIGHT|EYE|GRAY|PAL)\b' src/renderer/src/components/CoreScene.tsx || echo "CLEAN"
npm run typecheck && npm run build
```
Expected: `CLEAN`, typecheck passes (modulo the known SettingsPanel error), build exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/CoreScene.tsx
git commit -m "refactor: Core canvas reads themed sceneColors instead of hardcoded constants"
```

---

## Task 6: Main themes folder — loader, scaffold, merge, watch

**Files:**
- Create: `src/main/collectors/themes.ts`
- Modify: `src/main/state.ts` (populate `userThemes`; watch the folder)
- Test: `tests/themes.test.ts`

**Interfaces:**
- Consumes: `ThemeDef` from `@shared/types`; `CONFIG_DIR` from `../config`
- Produces: `themesDir(): string`, `parseThemeDef(name: string, text: string): ThemeDef | null`, `mergeThemes(inline: Record<string, ThemeDef> | undefined, folder: Record<string, ThemeDef>): Record<string, ThemeDef>`, `collectThemes(config: VaultHudConfig): Promise<Record<string, ThemeDef>>`, `EXAMPLE_THEMES: Record<string, string>`

- [ ] **Step 1: Write the failing test** (pure parse/merge only — fs is manual)

```ts
// tests/themes.test.ts
import { describe, it, expect } from 'vitest'
import { parseThemeDef, mergeThemes } from '../src/main/collectors/themes'

describe('parseThemeDef', () => {
  it('parses a valid theme and falls back name to the file stem', () => {
    const t = parseThemeDef('midnight', '{"colors":{"bg":"#0d0f14","ink":"#c8d0e0"}}')
    expect(t).not.toBeNull()
    expect(t!.name).toBe('midnight')
    expect(t!.colors!.bg).toBe('#0d0f14')
  })
  it('keeps an explicit name over the file stem', () => {
    expect(parseThemeDef('foo', '{"name":"Cool","colors":{}}')!.name).toBe('Cool')
  })
  it('returns null for invalid JSON or non-object', () => {
    expect(parseThemeDef('x', 'not json')).toBeNull()
    expect(parseThemeDef('x', '[1,2,3]')).toBeNull()
    expect(parseThemeDef('x', '42')).toBeNull()
  })
})

describe('mergeThemes', () => {
  it('folder themes override inline themes of the same name', () => {
    const inline = { a: { name: 'a', density: 'cozy' as const }, b: { name: 'b' } }
    const folder = { a: { name: 'a', density: 'airy' as const } }
    const m = mergeThemes(inline, folder)
    expect(m.a.density).toBe('airy') // folder wins
    expect(m.b.name).toBe('b') // inline-only preserved
  })
  it('handles undefined inline', () => {
    expect(mergeThemes(undefined, { a: { name: 'a' } })).toEqual({ a: { name: 'a' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/themes.test.ts`
Expected: FAIL — cannot find module `themes`.

- [ ] **Step 3: Write `themes.ts`** (mirrors `collectors/quotes.ts` structure + fail-soft)

```ts
// src/main/collectors/themes.ts
import { promises as fs } from 'node:fs'
import { join, parse } from 'node:path'
import type { ThemeDef, VaultHudConfig } from '@shared/types'
import { CONFIG_DIR } from '../config'

export function themesDir(): string {
  return join(CONFIG_DIR, 'themes')
}

// editable starter files written on first run — never overwritten afterward
export const EXAMPLE_THEMES: Record<string, string> = {
  'midnight.json': JSON.stringify(
    { name: 'midnight', colors: { bg: '#0d0f14', surface: '#12151c', ink: '#c8d0e0', accent: '#6ea8ff', mascotBody: '#d97757' }, density: 'cozy' },
    null,
    2
  ),
  'amber.json': JSON.stringify(
    { name: 'amber', colors: { bg: '#0f0b02', ink: '#ffb000', accent: '#ffcf4d', mascotBody: '#ffb000', mascotEye: '#0f0b02' }, density: 'cozy' },
    null,
    2
  )
}

// pure: file text → ThemeDef (or null when unusable). name falls back to file stem.
export function parseThemeDef(name: string, text: string): ThemeDef | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const def = parsed as ThemeDef
  return { ...def, name: typeof def.name === 'string' && def.name.trim() ? def.name : name }
}

// pure: folder themes win over inline themes of the same key
export function mergeThemes(
  inline: Record<string, ThemeDef> | undefined,
  folder: Record<string, ThemeDef>
): Record<string, ThemeDef> {
  return { ...(inline ?? {}), ...folder }
}

// scaffold the folder with examples on first run, then read every *.json (fail-soft)
export async function collectThemes(config: VaultHudConfig): Promise<Record<string, ThemeDef>> {
  const dir = themesDir()
  try {
    await fs.access(dir)
  } catch {
    try {
      await fs.mkdir(dir, { recursive: true })
      for (const [file, body] of Object.entries(EXAMPLE_THEMES)) {
        await fs.writeFile(join(dir, file), body)
      }
    } catch {
      /* fail soft: no folder → inline/builtins only */
    }
  }
  const folder: Record<string, ThemeDef> = {}
  try {
    for (const entry of await fs.readdir(dir)) {
      if (!entry.endsWith('.json')) continue
      try {
        const text = await fs.readFile(join(dir, entry), 'utf8')
        const def = parseThemeDef(parse(entry).name, text)
        if (def) folder[def.name as string] = def
      } catch {
        /* skip unreadable file */
      }
    }
  } catch {
    /* folder missing/unreadable → none */
  }
  return mergeThemes(config.ui.themes, folder)
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/themes.test.ts && npm run typecheck`
Expected: themes tests PASS (5).

- [ ] **Step 5: Wire into `state.ts`** — initialize, populate, and watch. (`HudState extends EventEmitter`; `watch` is already imported from `node:fs`; snapshots reach the renderer via the private `publish()` method which does `this.emit('snapshot', this.snapshot)`.)

Add the import near the other collectors:

```ts
import { collectThemes, themesDir } from './collectors/themes'
```

In the snapshot initializer in the constructor (where `quotes: []` is set), add:

```ts
      userThemes: {},
```

In `refreshAll()`, immediately after the `this.snapshot.quotes = await collectQuotes(this.config)` line, add:

```ts
    this.snapshot.userThemes = await collectThemes(this.config)
```

Add a new private watcher method modeled on `startWatcher()` (debounced 800ms, fail-soft; recollects themes then calls `this.publish()` — valid since it's inside the class):

```ts
  // watch the themes folder so a dropped-in / edited theme file hot-loads
  private startThemesWatcher(): void {
    let debounce: NodeJS.Timeout | null = null
    try {
      const w = watch(themesDir(), () => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(async () => {
          this.snapshot.userThemes = await collectThemes(this.config)
          this.publish()
        }, 800)
      })
      w.on('error', () => {
        /* folder not present yet; next refreshAll re-scaffolds + recollects */
      })
    } catch {
      /* fail soft: themes still load on the 60s refreshAll */
    }
  }
```

Call it right after the existing `this.startWatcher()` invocation (currently line 67):

```ts
    this.startWatcher()
    this.startThemesWatcher()
```

- [ ] **Step 6: Typecheck + full test run**

Run: `npm run typecheck && npm test`
Expected: all tests pass (modulo the known SettingsPanel error, fixed next task). If typecheck fails only in `SettingsPanel.tsx`, proceed.

- [ ] **Step 7: Commit**

```bash
git add src/main/collectors/themes.ts tests/themes.test.ts src/main/state.ts
git commit -m "feat: load, scaffold, merge, and watch ~/.vault-hud/themes/*.json"
```

---

## Task 7: Renderer wiring — resolve + apply the active theme

**Files:**
- Modify: `src/renderer/src/hud/App.tsx`

**Interfaces:**
- Consumes: `BUILTINS` (`theme/builtins`), `resolve` (`theme/resolve`), `applyTheme` (`theme/apply`), `setSceneColors` (`theme/sceneColors`); `snap.ui.theme`, `snap.userThemes`

*(Manual verification — the whole HUD recolors.)*

- [ ] **Step 1: Add imports** to `App.tsx`:

```ts
import { BUILTINS } from '../theme/builtins'
import { resolve } from '../theme/resolve'
import { applyTheme } from '../theme/apply'
import { setSceneColors } from '../theme/sceneColors'
```

- [ ] **Step 2: Replace the `dataset.theme` effect**

Find:

```ts
  useEffect(() => {
    if (snap) document.body.dataset.theme = snap.ui.theme
  }, [snap?.ui.theme])
```

Replace with:

```ts
  useEffect(() => {
    if (!snap) return
    const defs = { ...BUILTINS, ...snap.userThemes }
    const resolved = resolve(defs[snap.ui.theme] ?? BUILTINS.terminal)
    applyTheme(resolved)
    setSceneColors(resolved)
  }, [snap?.ui.theme, snap?.userThemes])
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: passes (SettingsPanel error still present until Task 8 — if it blocks the build, do Task 8 before building).

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Confirm:
- The HUD looks identical to before at default (`terminal`).
- Editing `~/.vault-hud/config.json` `"ui": { "theme": "paper" }` recolors **panels and the Core canvas + mascot** to cream/paper (previously the Core stayed dark — this is the fix).
- Setting `"theme": "midnight"` (scaffolded example) recolors everything to blue.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/hud/App.tsx
git commit -m "feat: resolve + apply the active theme across panels and canvas"
```

---

## Task 8: Settings picker + live vaultfetch swatches

**Files:**
- Modify: `src/renderer/src/components/SettingsPanel.tsx`
- Modify: `src/renderer/src/components/VaultfetchPanel.tsx`

**Interfaces:**
- Consumes: `BUILTINS` (`theme/builtins`), `getActiveTheme` (`theme/apply`); `snap.userThemes`, `snap.ui.theme`

*(Manual verification.)*

- [ ] **Step 1: Replace the 2-button toggle with a full picker** in `SettingsPanel.tsx`.

Add import:

```ts
import { BUILTINS } from '../theme/builtins'
```

Find the current toggle (the `(['terminal', 'paper'] as const).map(...)` block, ~lines 76–84) and replace it with a list over all available theme names:

```tsx
{Array.from(new Set([...Object.keys(BUILTINS), ...Object.keys(snap.userThemes)])).map((name) => (
  <button
    key={name}
    onClick={() => window.vault.updateConfig({ ui: { theme: name } })}
    style={{ color: snap.ui.theme === name ? 'var(--clay)' : 'var(--ink)', fontSize: 10 }}
  >
    {snap.ui.theme === name ? '● ' : '○ '}{name}
  </button>
))}
```

This also resolves the Task 2 typecheck error (the `as const` union assumption is gone).

- [ ] **Step 2: Make vaultfetch swatches read the active theme** in `VaultfetchPanel.tsx`.

Add import:

```ts
import { getActiveTheme } from '../theme/apply'
```

Remove the module-level `SWATCHES` constant (the `DEFAULT_PALETTE`-based array) and build it inside the component from the active theme, falling back to the mascot palette before the first `applyTheme`:

```ts
  const at = getActiveTheme()
  const SWATCHES = at
    ? [at.colors.mascotBody, at.colors.mascotDark, at.colors.mascotMuzzle, at.colors.mascotEye, at.colors.ink, at.colors.inkDim]
    : [DEFAULT_PALETTE.body, DEFAULT_PALETTE.dark, DEFAULT_PALETTE.muzzle, DEFAULT_PALETTE.eye, '#e8e6e3', '#9a9a9a']
```

(Keep the existing `DEFAULT_PALETTE` import for the fallback and the mascot logo.)

- [ ] **Step 3: Typecheck + full test + build**

Run: `npm run typecheck && npm test && npm run build`
Expected: all green, build exits 0, **zero** typecheck errors now.

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Confirm:
- Settings lists `terminal`, `paper`, `midnight`, `amber` (+ any files you drop in). Clicking one recolors the whole HUD live.
- The vaultfetch swatch row matches the active theme (switch themes → swatches change).
- Drop a new `~/.vault-hud/themes/forest.json` while running → it appears in the picker within a moment (folder watch).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/SettingsPanel.tsx src/renderer/src/components/VaultfetchPanel.tsx
git commit -m "feat: theme picker in Settings + live theme-driven vaultfetch swatches"
```

---

## Final verification

- [ ] `npm test` — all suites pass (color, resolve, builtins, themes + existing 114).
- [ ] `npm run typecheck` — zero errors.
- [ ] `npm run build` — exits 0.
- [ ] `git log --oneline` on `vaultfetch` shows 8 new commits, none with a `Co-Authored-By` trailer (`git log <base>..HEAD --format='%b' | grep -i co-author` returns nothing).
- [ ] Manual: switch every built-in + example theme; confirm panels **and** Core canvas + mascot recolor together; confirm density + font changes take effect on panels; confirm a dropped-in theme file hot-loads.

## Self-review notes (addressed)

- **Spec coverage:** data model (T2), color roles + derivation (T2), two-world unification (T4/T5/T7), fonts (T2 stack + constraint: no new binaries), density (T2/T4), drop-in folder + scaffold + watch + precedence (T6), built-in fallbacks (T3), settings picker (T8), live swatch (T8). All covered.
- **Fonts scope:** per Global Constraints, no font binaries are fetched; theme font names ride the front of the existing stack. Documented deviation from the spec's "bundle JetBrains Mono" (kept honest — dropping a `.woff2` + `@font-face` later is trivial).
- **Type consistency:** `ThemeDef`/`ThemeColors`/`Density` (shared) vs `ResolvedTheme`/`ResolvedColors` (roles.ts) are distinct by design (partial vs filled); `sceneColors.gray` ← `inkDim` (`#8f8f8f`) is a deliberate, imperceptible shift from the old `GRAY #9a9a9a`.
