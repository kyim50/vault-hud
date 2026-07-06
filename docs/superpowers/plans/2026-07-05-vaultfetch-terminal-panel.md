# vaultfetch Terminal-Art Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a neofetch-style `vaultfetch` panel as the first config-driven HUD module, establishing the minimal module-config seam that later customization work builds on.

**Architecture:** Two pure libs (`blockart` for half-block mascot art, `fetchLines` for spec-line formatting) + two additive `HudSnapshot` fields (`bootAt`, `quotes`) + a `MODULES` registry where each module carries `defaults` and reads per-module `{ enabled, options }` from config + a `VaultfetchPanel` that composes it all.

**Tech Stack:** TypeScript, React, Electron (electron-vite), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-05-vaultfetch-terminal-panel-design.md`

## Global Constraints

- Pure logic lives in `src/renderer/src/lib/*` (or `src/main/collectors/*` for main-side) and is unit-tested in `tests/*.test.ts`; React components render HTML in the mono font — box-drawing chars and glyphs are real text, never canvas.
- Half-block mascot art: character `▀`, `fg` = top pixel color, `bg` = bottom pixel color, pairing two sprite rows per glyph row. Transparent pixel → `null`.
- `FetchLineId` is exactly `uptime | repos | tokens | commits | provider | streak | mood`; default line order is that list.
- New `HudSnapshot` fields are additive; config merges must stay fail-soft (never throw on bad input).
- Existing panels must keep working — they migrate to the module registry with `defaults: {}`.
- Commands: tests `npm test`, focused `npm test -- <name>`, typecheck `npm run typecheck`, build `npm run build`.
- Commit after each task. (Do NOT add any `Co-Authored-By` trailer — this repo's history is kept co-author-free.)

---

### Task 1: Snapshot data — `bootAt`, `quotes`, and `ui.modules`

**Files:**
- Modify: `src/shared/types.ts` (add `bootAt`, `quotes` to `HudSnapshot`; add `modules` to `UiConfig`)
- Create: `src/main/collectors/quotes.ts`
- Create: `tests/quotes.test.ts`
- Modify: `src/main/state.ts` (populate `bootAt` + `quotes`)
- Modify: `tests/config.test.ts` (assert `ui.modules` survives a load)

**Interfaces:**
- Produces: `HudSnapshot.bootAt: number`, `HudSnapshot.quotes: string[]`, `UiConfig.modules?: Record<string, ModuleConfig>` where `ModuleConfig = { enabled?: boolean; options?: Record<string, unknown> }`; `parseQuotes(text: string): string[]`, `mergeQuotes(vaultText: string | null): string[]`, `DEFAULT_QUOTES: string[]`, `collectQuotes(config: VaultHudConfig): Promise<string[]>`.

- [ ] **Step 1: Write the failing test**

Create `tests/quotes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseQuotes, mergeQuotes, DEFAULT_QUOTES } from '../src/main/collectors/quotes'

describe('parseQuotes', () => {
  it('reads markdown list items and plain lines, stripping wrapping quotes', () => {
    const md = '# Quotes\n- first one\n- "second, quoted"\n\nthird line\n'
    expect(parseQuotes(md)).toEqual(['first one', 'second, quoted', 'third line'])
  })
  it('ignores blank lines and a lone heading', () => {
    expect(parseQuotes('# Quotes\n\n')).toEqual([])
  })
})

describe('mergeQuotes', () => {
  it('falls back to defaults when there is no vault file', () => {
    expect(mergeQuotes(null)).toEqual(DEFAULT_QUOTES)
  })
  it('puts vault quotes first, then defaults, deduped', () => {
    const out = mergeQuotes('- custom line')
    expect(out[0]).toBe('custom line')
    expect(out).toEqual(['custom line', ...DEFAULT_QUOTES])
    expect(new Set(out).size).toBe(out.length) // no dupes
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- quotes`
Expected: FAIL — `Cannot find module '../src/main/collectors/quotes'`.

- [ ] **Step 3: Create `src/main/collectors/quotes.ts`**

```ts
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { VaultHudConfig } from '@shared/types'

// shipped defaults — the panel is never empty
export const DEFAULT_QUOTES: string[] = [
  'the vault is quiet today.',
  'small steps compound.',
  'ship it, then tend it.',
  'the map is not the territory.',
  'make it work, make it right, make it fast.',
  'a clear head is a fast head.',
  'delete more than you add.',
  'the best code is no code.',
  'progress, not perfection.',
  'read the error message.',
  'name things for what they do.',
  'sleep is a feature.',
  'touch grass, then touch code.',
  'the panda is watching.',
  'commit early, commit often.',
  'done is a decision.',
  'one thing at a time.',
  'the terminal remembers.'
]

// pure: markdown/plain text -> quote lines (list items or non-empty lines),
// wrapping quotes stripped, headings/blank lines ignored
export function parseQuotes(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map((l) => l.replace(/^[-*]\s+/, ''))
    .map((l) => l.replace(/^["']|["']$/g, '').trim())
    .filter((l) => l.length > 0)
}

// pure: vault file text (or null) merged with defaults, vault-first, deduped
export function mergeQuotes(vaultText: string | null): string[] {
  const vault = vaultText ? parseQuotes(vaultText) : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of [...vault, ...DEFAULT_QUOTES]) {
    if (seen.has(q)) continue
    seen.add(q)
    out.push(q)
  }
  return out
}

// fs read of Quotes.md (vault root, then dashboard folder); fail-soft to defaults
export async function collectQuotes(config: VaultHudConfig): Promise<string[]> {
  if (!config.vaultPath) return mergeQuotes(null)
  for (const p of [join(config.vaultPath, 'Quotes.md'), join(config.vaultPath, config.dashboardFolder, 'Quotes.md')]) {
    try {
      const text = await fs.readFile(p, 'utf8')
      return mergeQuotes(text)
    } catch {
      /* try next / fall through to defaults */
    }
  }
  return mergeQuotes(null)
}
```

- [ ] **Step 4: Run the quotes test to verify it passes**

Run: `npm test -- quotes`
Expected: PASS.

- [ ] **Step 5: Add the type fields in `src/shared/types.ts`**

In `UiConfig` (currently `theme`/`parade`/`layout`/`audio`), add:

```ts
export interface ModuleConfig {
  enabled?: boolean
  options?: Record<string, unknown>
}
```

and a field on `UiConfig`:

```ts
  modules?: Record<string, ModuleConfig> // per-module rice slice: enable + options
```

In `HudSnapshot`, add these two fields (additive):

```ts
  bootAt: number // main-process start time — uptime source
  quotes: string[] // defaults merged with a vault Quotes.md when present
```

- [ ] **Step 6: Populate the fields in `src/main/state.ts`**

At the top of the file (after imports) add a boot timestamp and the collector import:

```ts
import { collectQuotes } from './collectors/quotes'

const BOOT_AT = Date.now()
```

In the `this.snapshot = { ... }` initializer (constructor), add:

```ts
      bootAt: BOOT_AT,
      quotes: [],
```

In `refreshAll()`, after `this.snapshot.usage = usage`, add:

```ts
    this.snapshot.quotes = await collectQuotes(this.config)
```

- [ ] **Step 7: Extend `tests/config.test.ts` to prove `ui.modules` survives a load**

Add this test inside the existing config `describe` block (match the file's existing load helper — it loads a raw object and asserts the normalized config). If the file exposes the loader as `loadOrCreateConfig`/`normalizeConfig`, call whichever it already uses; the assertion is:

```ts
it('preserves ui.modules through a load (fail-soft rice slice)', async () => {
  const raw = { ui: { theme: 'terminal', parade: true, modules: { fetch: { enabled: false, options: { showLogo: false } } } } }
  const cfg = normalizeConfig(raw) // use the same normalize/merge fn the other tests call
  expect(cfg.ui.modules?.fetch?.enabled).toBe(false)
  expect(cfg.ui.modules?.fetch?.options).toEqual({ showLogo: false })
})
```

If `tests/config.test.ts` uses a different entry point name, mirror the surrounding tests exactly — the point is: a config with `ui.modules` loads without throwing and the slice is retained.

- [ ] **Step 8: Run the full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass; no type errors. (`config.ts`'s existing `ui: { ...defaults.ui, ...p.ui }` merge already carries `modules` through — no `config.ts` change needed.)

- [ ] **Step 9: Commit**

```bash
git add src/shared/types.ts src/main/collectors/quotes.ts tests/quotes.test.ts src/main/state.ts tests/config.test.ts
git commit -m "feat: snapshot bootAt + quotes, ui.modules config slice"
```

---

### Task 2: `blockart.ts` — half-block mascot art (pure)

**Files:**
- Create: `src/renderer/src/lib/blockart.ts`
- Create: `tests/blockart.test.ts`

**Interfaces:**
- Consumes: `pandaColor`, `DEFAULT_PALETTE`, `type PandaPalette` from `src/renderer/src/lib/panda.ts`.
- Produces: `interface Cell { ch: string; fg: string | null; bg: string | null }`; `spriteToHalfBlocks(matrix: string[], palette: PandaPalette): Cell[][]`.

- [ ] **Step 1: Write the failing test**

Create `tests/blockart.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { spriteToHalfBlocks } from '../src/renderer/src/lib/blockart'
import { DEFAULT_PALETTE } from '../src/renderer/src/lib/panda'

describe('spriteToHalfBlocks', () => {
  it('pairs two sprite rows into one glyph row, preserving width', () => {
    const out = spriteToHalfBlocks(['BB', 'BB', 'B.', '.B'], DEFAULT_PALETTE)
    expect(out).toHaveLength(2)
    expect(out[0]).toHaveLength(2)
    expect(out[0][0].ch).toBe('▀')
  })
  it('maps the top pixel to fg and the bottom pixel to bg', () => {
    const out = spriteToHalfBlocks(['B', '.'], DEFAULT_PALETTE)
    expect(out[0][0].fg).toBe(DEFAULT_PALETTE.body) // 'B' -> body
    expect(out[0][0].bg).toBeNull() // '.' -> transparent
  })
  it('pairs an odd trailing row against transparent', () => {
    const out = spriteToHalfBlocks(['B'], DEFAULT_PALETTE)
    expect(out).toHaveLength(1)
    expect(out[0][0].fg).toBe(DEFAULT_PALETTE.body)
    expect(out[0][0].bg).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- blockart`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/renderer/src/lib/blockart.ts`**

```ts
import { pandaColor, type PandaPalette } from './panda'

export interface Cell {
  ch: string
  fg: string | null // null = transparent (renders as panel background)
  bg: string | null
}

// Render a sprite matrix (char language B/D/n/E/L/.) as half-block terminal
// art: '▀' with fg = top pixel color, bg = bottom pixel color, pairing two
// sprite rows per glyph row so the ~1:2 monospace cell keeps correct aspect.
export function spriteToHalfBlocks(matrix: string[], palette: PandaPalette): Cell[][] {
  const width = matrix.reduce((w, r) => Math.max(w, r.length), 0)
  const rows: Cell[][] = []
  for (let y = 0; y < matrix.length; y += 2) {
    const top = matrix[y] ?? ''
    const bottom = matrix[y + 1] ?? ''
    const row: Cell[] = []
    for (let x = 0; x < width; x++) {
      row.push({
        ch: '▀',
        fg: pandaColor(top[x] ?? '.', palette, false),
        bg: pandaColor(bottom[x] ?? '.', palette, false)
      })
    }
    rows.push(row)
  }
  return rows
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- blockart`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/blockart.ts tests/blockart.test.ts
git commit -m "feat: blockart — half-block sprite art for terminal panels"
```

---

### Task 3: `fetchLines.ts` — spec-line formatting (pure)

**Files:**
- Create: `src/renderer/src/lib/fetchLines.ts`
- Create: `tests/fetchLines.test.ts`

**Interfaces:**
- Consumes: `HudSnapshot` (with `bootAt` from Task 1) from `@shared/types`.
- Produces: `type FetchLineId`, `interface FetchLine { id: FetchLineId; label: string; value: string }`, `fmtUptime(ms: number): string`, `bar(pct: number, width: number): string`, `dots(n: number, total: number, width: number): string`, `fetchLines(snap: HudSnapshot, now: number, ids: FetchLineId[]): FetchLine[]`.

- [ ] **Step 1: Write the failing test**

Create `tests/fetchLines.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fmtUptime, bar, dots, fetchLines } from '../src/renderer/src/lib/fetchLines'
import type { HudSnapshot } from '../src/shared/types'

describe('formatters', () => {
  it('fmtUptime picks the right unit', () => {
    expect(fmtUptime(45_000)).toBe('45s')
    expect(fmtUptime(12 * 60_000)).toBe('12m')
    expect(fmtUptime(3 * 3600_000 + 12 * 60_000)).toBe('3h 12m')
  })
  it('bar fills proportionally to width', () => {
    expect(bar(0, 5)).toBe('░░░░░')
    expect(bar(100, 5)).toBe('▓▓▓▓▓')
    expect(bar(40, 5)).toBe('▓▓░░░')
  })
  it('dots fills n of width', () => {
    expect(dots(4, 7, 5)).toBe('●●●●○')
    expect(dots(9, 9, 5)).toBe('●●●●●')
  })
})

const snap = {
  appName: 'vault',
  bootAt: 1_000,
  repos: [{ dirtyFiles: 2 } as any, { dirtyFiles: 0 } as any],
  usage: { provider: 'anthropic', mode: 'tokens', percent: 27, windowTokens: 0, updatedAt: 0 },
  primary: { label: '', value: 45, target: 30, unit: '' },
  directives: [{ done: true } as any, { done: true } as any, { done: false } as any],
  mood: 'happy',
  pet: { name: 'kimani', xp: 0 }
} as unknown as HudSnapshot

describe('fetchLines', () => {
  it('emits only the requested ids, in order', () => {
    const out = fetchLines(snap, 1_000 + 60_000, ['repos', 'uptime'])
    expect(out.map((l) => l.id)).toEqual(['repos', 'uptime'])
    expect(out[0].value).toBe('2 · 2✗') // 2 repos, 2 dirty total
    expect(out[1].value).toBe('1m')
  })
  it('formats streak, tokens, commits, provider, mood', () => {
    const byId = Object.fromEntries(
      fetchLines(snap, snap.bootAt, ['streak', 'tokens', 'commits', 'provider', 'mood']).map((l) => [l.id, l.value])
    )
    expect(byId.streak).toBe('●●○○○ 2d')
    expect(byId.tokens).toBe('▓░░░░ 27%')
    expect(byId.commits).toBe('45/30 ↑')
    expect(byId.provider).toBe('anthropic')
    expect(byId.mood).toBe('focused')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- fetchLines`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/renderer/src/lib/fetchLines.ts`**

```ts
import type { HudSnapshot } from '@shared/types'

export type FetchLineId = 'uptime' | 'repos' | 'tokens' | 'commits' | 'provider' | 'streak' | 'mood'

export interface FetchLine {
  id: FetchLineId
  label: string
  value: string
}

export function fmtUptime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

export function bar(pct: number, width: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width)
  return '▓'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

export function dots(n: number, _total: number, width: number): string {
  const filled = Math.max(0, Math.min(width, n))
  return '●'.repeat(filled) + '○'.repeat(Math.max(0, width - filled))
}

// Build the requested spec lines (only those ids, in the given order) from a
// snapshot. `now` is injected so this stays pure/testable.
export function fetchLines(snap: HudSnapshot, now: number, ids: FetchLineId[]): FetchLine[] {
  const dirty = snap.repos.reduce((sum, r) => sum + r.dirtyFiles, 0)
  const done = snap.directives.filter((d) => d.done).length
  const cpu = snap.usage.mode === 'cpu'
  const line = (id: FetchLineId): FetchLine => {
    switch (id) {
      case 'uptime':
        return { id, label: 'uptime', value: fmtUptime(now - snap.bootAt) }
      case 'repos':
        return { id, label: 'repos', value: `${snap.repos.length} · ${dirty}✗` }
      case 'tokens':
        return { id, label: cpu ? 'cpu' : 'tokens', value: `${bar(snap.usage.percent, 5)} ${snap.usage.percent}%` }
      case 'commits':
        return { id, label: 'commits', value: `${snap.primary.value}/${snap.primary.target} ↑` }
      case 'provider':
        return { id, label: 'provider', value: snap.usage.provider }
      case 'streak':
        return { id, label: 'streak', value: `${dots(done, snap.directives.length, 5)} ${done}d` }
      case 'mood':
        return { id, label: 'mood', value: snap.mood === 'napping' ? 'napping 💤' : 'focused' }
    }
  }
  return ids.map(line)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- fetchLines`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/fetchLines.ts tests/fetchLines.test.ts
git commit -m "feat: fetchLines — neofetch-style spec-line formatters"
```

---

### Task 4: The module-config seam — `MODULES` registry + per-module resolve

**Files:**
- Create: `src/renderer/src/modules/types.ts`
- Create: `src/renderer/src/modules/resolve.ts`
- Create: `tests/moduleResolve.test.ts`
- Modify: `src/renderer/src/hud/App.tsx` (convert `PANELS` → `MODULES`, honor `enabled`/`options`)

**Interfaces:**
- Consumes: `HudSnapshot`, `ModuleConfig` (Task 1) from `@shared/types`.
- Produces: `interface HudModule<Opt> { id: string; defaults: Opt; render: (snap: HudSnapshot, opts: Opt) => ReactNode }`; `resolveModule<T>(defaults: T, cfg?: ModuleConfig): { enabled: boolean; options: T }`.

- [ ] **Step 1: Write the failing test**

Create `tests/moduleResolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveModule } from '../src/renderer/src/modules/resolve'

describe('resolveModule', () => {
  it('enabled by default, options = defaults when no config', () => {
    expect(resolveModule({ a: 1, b: 2 })).toEqual({ enabled: true, options: { a: 1, b: 2 } })
  })
  it('merges option overrides over defaults', () => {
    expect(resolveModule({ a: 1, b: 2 }, { options: { b: 9 } }).options).toEqual({ a: 1, b: 9 })
  })
  it('respects enabled: false', () => {
    expect(resolveModule({}, { enabled: false }).enabled).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- moduleResolve`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/renderer/src/modules/types.ts`**

```ts
import type { ReactNode } from 'react'
import type { HudSnapshot } from '@shared/types'

// A HUD module: a rendered unit (panel today) with shipped option defaults.
// The registry + config.ui.modules make every module toggleable/configurable.
export interface HudModule<Opt = Record<string, never>> {
  id: string
  defaults: Opt
  render: (snap: HudSnapshot, opts: Opt) => ReactNode
}
```

- [ ] **Step 4: Create `src/renderer/src/modules/resolve.ts`**

```ts
import type { ModuleConfig } from '@shared/types'

// Merge a module's shipped defaults with the user's rice slice.
export function resolveModule<T>(defaults: T, cfg?: ModuleConfig): { enabled: boolean; options: T } {
  return {
    enabled: cfg?.enabled !== false,
    options: { ...defaults, ...((cfg?.options ?? {}) as Partial<T>) } as T
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- moduleResolve`
Expected: PASS.

- [ ] **Step 6: Convert `PANELS` → `MODULES` in `src/renderer/src/hud/App.tsx`**

Replace the `PANELS` const (currently `Record<string, (s: HudSnapshot) => ReactNode>`, lines ~21-29) with a `MODULES` registry. Add imports at the top:

```ts
import type { HudModule } from '../modules/types'
import { resolveModule } from '../modules/resolve'
```

Then:

```ts
const MODULES: Record<string, HudModule<any>> = {
  vitals: { id: 'vitals', defaults: {}, render: (s) => <VitalsPanel repos={s.repos} usage={s.usage} audio={s.ui.audio} /> },
  directives: { id: 'directives', defaults: {}, render: (s) => <DirectivesPanel directives={s.directives} /> },
  brain: { id: 'brain', defaults: {}, render: (s) => <SecondBrainPanel recent={s.brain.recent} resurfaced={s.brain.resurfaced} /> },
  deck: { id: 'deck', defaults: {}, render: (s) => <CommandDeck commands={s.commands} /> },
  schedule: { id: 'schedule', defaults: {}, render: (s) => <SchedulePanel schedule={s.schedule} /> },
  skills: { id: 'skills', defaults: {}, render: (s) => <SkillsPanel skills={s.skills} /> },
  totem: { id: 'totem', defaults: {}, render: (s) => <TotemPanel sprite={s.sprites.find((sp) => sp.use === 'totem')} /> }
}
```

Update `sanitizeLayout` to test membership against `MODULES` (change `id in PANELS` to `id in MODULES`).

Find the render loop that calls `PANELS[id](snap)` (around line 162). Replace it so disabled modules are skipped and options are passed. The loop currently maps over the column's `ids`; change the body to resolve the module and render, e.g.:

```tsx
{ids.map((id) => {
  const mod = MODULES[id]
  if (!mod) return null
  const { enabled, options } = resolveModule(mod.defaults, snap.ui.modules?.[id])
  if (!enabled) return null
  return (
    <div key={id} /* ...keep the existing wrapper div's props (grip, drag handlers, style)... */>
      <span className="grip" title="drag to rearrange" onMouseDown={() => setArmed(id)} onMouseUp={() => setArmed(null)}>⠿</span>
      {mod.render(snap, options)}
    </div>
  )
})}
```

Keep every existing prop on the wrapper `<div>` and the `<span className="grip">` exactly as they are — only the membership check, the enabled/options resolution, and `mod.render(snap, options)` are new. Leave `DEFAULT_LAYOUT` and `GROWS` unchanged in this task.

- [ ] **Step 7: Typecheck + build + full suite**

Run: `npm run typecheck && npm test && npm run build`
Expected: all clean. The HUD renders exactly as before (all modules enabled, empty options) — this task is a behavior-preserving refactor plus the new toggle/options capability.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/modules/types.ts src/renderer/src/modules/resolve.ts tests/moduleResolve.test.ts src/renderer/src/hud/App.tsx
git commit -m "feat: module-config seam — MODULES registry with enable/options"
```

---

### Task 5: `VaultfetchPanel` — compose it and register the `fetch` module

**Files:**
- Create: `src/renderer/src/components/VaultfetchPanel.tsx`
- Modify: `src/renderer/src/hud/App.tsx` (register `fetch` in `MODULES`, add to `DEFAULT_LAYOUT`)

**Interfaces:**
- Consumes: `spriteToHalfBlocks` (Task 2), `fetchLines` + `FetchLineId` (Task 3), `HudModule` (Task 4), `PANDA` + `DEFAULT_PALETTE` from `../lib/panda`, `Panel` from `./Panel`.
- Produces: `interface FetchOptions { lines: FetchLineId[]; showLogo: boolean; showSwatches: boolean; quoteRotateSec: number }`, `DEFAULT_FETCH_OPTIONS`, `VaultfetchPanel`.

> This task's deliverable is a React component (canvas-free, but interval-driven), verified by typecheck + build + manual `npm run dev`. Its pure inputs (`blockart`, `fetchLines`) are already unit-tested in Tasks 2-3, so there is no new unit test here.

- [ ] **Step 1: Create `src/renderer/src/components/VaultfetchPanel.tsx`**

```tsx
import { Fragment, useEffect, useState } from 'react'
import type { HudSnapshot } from '@shared/types'
import { Panel } from './Panel'
import { PANDA, DEFAULT_PALETTE } from '../lib/panda'
import { spriteToHalfBlocks } from '../lib/blockart'
import { fetchLines, type FetchLineId } from '../lib/fetchLines'

export interface FetchOptions {
  lines: FetchLineId[]
  showLogo: boolean
  showSwatches: boolean
  quoteRotateSec: number // 0 = static
}

export const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  lines: ['uptime', 'repos', 'tokens', 'commits', 'provider', 'streak', 'mood'],
  showLogo: true,
  showSwatches: true,
  quoteRotateSec: 20
}

const SWATCHES = [
  DEFAULT_PALETTE.body,
  DEFAULT_PALETTE.dark,
  DEFAULT_PALETTE.muzzle,
  DEFAULT_PALETTE.eye,
  '#e8e6e3',
  '#9a9a9a'
]

export function VaultfetchPanel({ snap, opts }: { snap: HudSnapshot; opts: FetchOptions }) {
  // 1s tick so uptime stays live; a separate counter rotates the quote
  const [, setTick] = useState(0)
  const [qi, setQi] = useState(() => Math.floor(Math.random() * Math.max(1, snap.quotes.length)))
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (opts.quoteRotateSec <= 0 || snap.quotes.length < 2) return
    const t = setInterval(
      () => setQi((i) => (i + 1 + Math.floor(Math.random() * (snap.quotes.length - 1))) % snap.quotes.length),
      opts.quoteRotateSec * 1000
    )
    return () => clearInterval(t)
  }, [opts.quoteRotateSec, snap.quotes.length])

  const logo = spriteToHalfBlocks(PANDA, DEFAULT_PALETTE)
  const lines = fetchLines(snap, Date.now(), opts.lines)
  const quote = snap.quotes[qi % Math.max(1, snap.quotes.length)] ?? ''
  const header = `${snap.pet.name}@${snap.appName}`

  return (
    <Panel title="◈ VAULTFETCH">
      <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1 }}>
        {opts.showLogo && (
          <div style={{ lineHeight: '0.62em', letterSpacing: 0, whiteSpace: 'pre' }}>
            {logo.map((row, y) => (
              <div key={y} style={{ display: 'flex' }}>
                {row.map((c, x) => (
                  <span key={x} style={{ color: c.fg ?? 'transparent', background: c.bg ?? 'transparent' }}>
                    {c.ch}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 2, alignContent: 'start' }}>
          <div className="clay" style={{ gridColumn: '1 / -1' }}>{header}</div>
          <div className="dim" style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--line)', marginBottom: 2 }} />
          {lines.map((l) => (
            <Fragment key={l.id}>
              <span className="dim">{l.label}</span>
              <span>{l.value}</span>
            </Fragment>
          ))}
        </div>
      </div>
      {opts.showSwatches && (
        <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
          {SWATCHES.map((c, i) => (
            <span key={i} style={{ width: 14, height: 8, background: c, display: 'inline-block' }} />
          ))}
        </div>
      )}
      <div className="dim" style={{ marginTop: 8, fontStyle: 'italic', fontSize: 10 }}>&ldquo;{quote}&rdquo;</div>
    </Panel>
  )
}
```

- [ ] **Step 2: Register the `fetch` module and add it to the default layout in `src/renderer/src/hud/App.tsx`**

Add the import:

```ts
import { VaultfetchPanel, DEFAULT_FETCH_OPTIONS, type FetchOptions } from '../components/VaultfetchPanel'
```

Add an entry to the `MODULES` registry:

```ts
  fetch: { id: 'fetch', defaults: DEFAULT_FETCH_OPTIONS, render: (s, o: FetchOptions) => <VaultfetchPanel snap={s} opts={o} /> },
```

Add `fetch` to the default layout (top of the left column):

```ts
const DEFAULT_LAYOUT: PanelLayout = {
  left: ['fetch', 'vitals', 'directives', 'brain'],
  right: ['deck', 'schedule', 'totem', 'skills']
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`
Confirm in the HUD:
- A `◈ VAULTFETCH` panel at the top of the left column showing the blob as clay-colored half-block art, `key value` spec lines (uptime ticking, repos, tokens bar, commits, provider, streak dots, mood), a swatch row, and an italic quote that changes every ~20s.
- Drag it to the other column via the ⠿ grip — it moves and persists like any panel.
- Edit `~/.vault-hud/config.json` → `"ui": { "modules": { "fetch": { "options": { "lines": ["uptime","tokens"], "showLogo": false } } } }`, restart: only those two lines render and the logo is hidden. Set `"enabled": false` → the panel disappears.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/VaultfetchPanel.tsx src/renderer/src/hud/App.tsx
git commit -m "feat: vaultfetch panel — the first config-driven HUD module"
```

---

## Self-Review

**Spec coverage:**
- Part B module seam (`HudModule`, `MODULES`, `ui.modules` `{enabled,options}`, effective = defaults⊕rice) → **Task 1** (config type) + **Task 4** (registry/resolve/App). ✓
- Part C.1 `blockart` half-block art → **Task 2**. ✓
- Part C.2 `fetchLines` + `fmtUptime`/`bar`/`dots`, only-requested-ids-in-order → **Task 3**. ✓
- Part C.3 swatches, C.4 rotating quote, C.5 `VaultfetchPanel` composition + registration + layout → **Task 5**. ✓
- `FetchOptions` (lines/showLogo/showSwatches/quoteRotateSec) user-controllable → **Task 5** + honored via **Task 4** resolve. ✓
- Part D `bootAt`, `quotes` (defaults ⊕ vault `Quotes.md`, deduped, fail-soft), `ui.modules` merge → **Task 1**. ✓
- Testing: blockart, fetchLines, quotes, moduleResolve, config all unit-tested; panel manual-verified. ✓

**Placeholder scan:** No TBD/TODO. Every code and test step shows complete code. The one soft reference — Task 1 Step 7 says "use the same normalize/merge fn the other tests call" — is because the exact loader name lives in `tests/config.test.ts`; the assertion and intent are fully specified.

**Type consistency:** `Cell`, `FetchLineId`/`FetchLine`, `HudModule`/`resolveModule`, `FetchOptions`/`DEFAULT_FETCH_OPTIONS`, and `ModuleConfig` are named identically across the tasks that define and consume them. `fetchLines(snap, now, ids)` signature matches its call in Task 5. `resolveModule(defaults, cfg)` matches its call in Task 4 Step 6.
