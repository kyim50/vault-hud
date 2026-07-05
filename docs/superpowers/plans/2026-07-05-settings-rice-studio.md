# Settings Rice Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the cramped, clipping Settings overlay into a tabbed **rice studio** — the complete, no-editor control panel (theme, layout/zones, scenes, sprites) plus **export/import a whole look as one rice file**.

**Architecture:** `SettingsPanel.tsx` becomes a thin tabbed shell over per-tab components in `components/settings/`, all built from a shared `settings/primitives.tsx` control vocabulary (Section, Row, Stepper, Toggle, Chips, Picker) — the wrapping `Chips` is what fixes the theme-row clipping. A pure `lib/rice.ts` builds/parses a self-contained `RiceBundle`; import applies it through the existing `updateConfig`/`saveSprite` IPC (no main-process changes).

**Tech Stack:** TypeScript, React, Electron, Vitest. Renderer at `src/renderer/src`, shared types at `src/shared`, tests at `tests/`.

## Global Constraints

- Branch: `vaultfetch` — stay on it, do NOT create a branch or merge (the arc continues with sub-project E before the big merge).
- No `Co-Authored-By` trailer on any commit.
- Live-apply everywhere: no restart. Every config write shallow-merges (`Object.assign(config.ui, patch.ui)`), so every write MUST spread the current slice — `updateConfig({ ui: { scenes: { ...snap.ui.scenes, busy } } })`, `{ ...snap.ui.geometry, ... }`, etc.
- Fixed-layout math (zones, widths, flex) MUST reuse the D resolvers (`resolveLayout`, `resolveGeometry`, `GEOMETRY_BOUNDS`, `DEFAULT_ZONES`) so Settings and the drag path stay identical — never re-derive layout rules by hand.
- Built-in themes (`terminal`, `paper`) are immutable — density/font edits target user themes (`ui.themes[name]`) only; for a built-in the control is read-only with a note.
- Import validates before applying; a malformed bundle is inert (no partial apply).
- Verification gates: `npm test` (Vitest), `npm run typecheck`, `npm run build`. The pure `lib/rice.ts` is unit-tested; all DOM/tab/canvas behavior is verified manually in `npm run dev` and reported as manually-verifiable-only — never fabricate an automated pass for it.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/renderer/src/lib/rice.ts` | **New, pure.** `buildRice(snap)`, `parseRice(text)`, bundle validation. |
| `src/shared/types.ts` | `RiceBundle` interface. |
| `src/renderer/src/components/SettingsPanel.tsx` | Rewritten: tabbed shell (tab state + sizing). |
| `src/renderer/src/components/settings/primitives.tsx` | **New.** Section, Row, Stepper, Toggle, Chips, Picker. |
| `src/renderer/src/components/settings/AppearanceTab.tsx` | **New.** theme, density, fonts, frame, audio. |
| `src/renderer/src/components/settings/ScenesTab.tsx` | **New.** rotation, speed, busy, nap. |
| `src/renderer/src/components/settings/LayoutTab.tsx` | **New.** zone manager + module on/off. |
| `src/renderer/src/components/settings/SpritesTab.tsx` | **New.** Sprite Studio + Repos (moved verbatim). |
| `src/renderer/src/components/settings/ShareTab.tsx` | **New.** export/import a rice. |
| `src/renderer/src/components/CoreScene.tsx` | Export `SCENE_NAMES` (for the busy/nap pickers). |
| `tests/rice.test.ts` | **New.** Unit tests for `lib/rice.ts`. |

---

## Task 1: RiceBundle type + `lib/rice.ts` pure build/parse

Purely additive — a new file + type. Tree stays green.

**Files:**
- Create: `src/renderer/src/lib/rice.ts`
- Modify: `src/shared/types.ts` (add `RiceBundle`, after `UiConfig`)
- Test: `tests/rice.test.ts`

**Interfaces:**
- Consumes: `UiConfig`, `ThemeDef`, `CustomSprite`, `HudSnapshot` from `@shared/types`.
- Produces: `interface RiceBundle { v: 1; ui: UiConfig; themes?: Record<string, ThemeDef>; sprites?: CustomSprite[] }`; `buildRice(snap: HudSnapshot): RiceBundle`; `parseRice(text: string): { ok: true; bundle: RiceBundle } | { ok: false; error: string }`.

- [ ] **Step 1: Add the `RiceBundle` type**

In `src/shared/types.ts`, immediately after the `UiConfig` interface, add:

```ts
// A self-contained shareable "rice": the whole look in one JSON.
export interface RiceBundle {
  v: 1
  ui: UiConfig
  themes?: Record<string, ThemeDef> // embedded theme defs so a recipient needs no theme files
  sprites?: CustomSprite[]
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/rice.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildRice, parseRice } from '../src/renderer/src/lib/rice'
import type { HudSnapshot } from '../src/shared/types'

const snap = {
  ui: { theme: 'midnight', parade: true, layout: { zones: [['core']] }, geometry: { coreMax: 700 } },
  userThemes: { midnight: { name: 'midnight', colors: { bg: '#000', ink: '#fff' } } },
  sprites: [{ name: 'cat', grid: [['#f00']], use: 'totem' }]
} as unknown as HudSnapshot

describe('buildRice', () => {
  it('bundles ui, embedded themes, and sprites with version 1', () => {
    const r = buildRice(snap)
    expect(r.v).toBe(1)
    expect(r.ui.theme).toBe('midnight')
    expect(r.themes?.midnight?.colors.bg).toBe('#000')
    expect(r.sprites?.[0]?.name).toBe('cat')
  })
  it('does not duplicate themes inside ui (defs live only in bundle.themes)', () => {
    expect(buildRice(snap).ui.themes).toBeUndefined()
  })
})

describe('parseRice', () => {
  it('round-trips a built bundle', () => {
    const text = JSON.stringify(buildRice(snap))
    const res = parseRice(text)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.bundle.ui.theme).toBe('midnight')
  })
  it('fail-soft: invalid JSON → error, no throw', () => {
    const res = parseRice('{not json')
    expect(res.ok).toBe(false)
  })
  it('fail-soft: wrong version → error', () => {
    expect(parseRice(JSON.stringify({ v: 2, ui: {} })).ok).toBe(false)
  })
  it('fail-soft: missing ui → error', () => {
    expect(parseRice(JSON.stringify({ v: 1 })).ok).toBe(false)
  })
  it('fail-soft: non-object / array → error', () => {
    expect(parseRice('[]').ok).toBe(false)
    expect(parseRice('42').ok).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/rice.test.ts`
Expected: FAIL — `Cannot find module '../src/renderer/src/lib/rice'`.

- [ ] **Step 4: Implement**

Create `src/renderer/src/lib/rice.ts`:

```ts
import type { CustomSprite, HudSnapshot, RiceBundle, ThemeDef, UiConfig } from '@shared/types'

// Build a self-contained rice from the live snapshot. Theme defs are embedded
// in `themes` (pulled from the resolved userThemes, which already merges inline
// + folder themes) — NOT duplicated inside `ui`, so import can merge them into
// the recipient's theme library cleanly.
export function buildRice(snap: HudSnapshot): RiceBundle {
  const ui: UiConfig = { ...(snap.ui as UiConfig) }
  delete (ui as { themes?: unknown }).themes // defs travel in bundle.themes, not duplicated in ui
  const bundle: RiceBundle = { v: 1, ui }
  const themes = snap.userThemes as Record<string, ThemeDef>
  if (themes && Object.keys(themes).length > 0) bundle.themes = themes
  if (snap.sprites && snap.sprites.length > 0) bundle.sprites = snap.sprites as CustomSprite[]
  return bundle
}

// Parse + validate rice text. Never throws — returns a typed result so the UI
// can show an error and change nothing on a malformed paste.
export function parseRice(text: string): { ok: true; bundle: RiceBundle } | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'not valid JSON' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'not a rice object' }
  }
  const b = parsed as Partial<RiceBundle>
  if (b.v !== 1) return { ok: false, error: 'unsupported rice version' }
  if (typeof b.ui !== 'object' || b.ui === null) return { ok: false, error: 'missing ui' }
  return { ok: true, bundle: { v: 1, ui: b.ui as UiConfig, themes: b.themes, sprites: b.sprites } }
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/rice.test.ts && npm run typecheck`
Expected: all rice tests PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/rice.ts src/shared/types.ts tests/rice.test.ts
git commit -m "feat: RiceBundle type + pure buildRice/parseRice"
```

---

## Task 2: Tabbed shell + primitives + rehome existing controls (fixes the clipping)

Rewrites `SettingsPanel` into a shell and moves today's controls into Appearance / Scenes / Sprites tabs built from shared primitives. This is the deliverable that fixes Image #4. No new *capabilities* yet (Layout manager, busy/nap, share come next) — but the theme row wraps, the panel is sized/scrollable, and controls are consistent.

**Files:**
- Create: `src/renderer/src/components/settings/primitives.tsx`, `AppearanceTab.tsx`, `ScenesTab.tsx`, `SpritesTab.tsx`
- Modify: `src/renderer/src/components/SettingsPanel.tsx` (rewrite into shell)

**Interfaces:**
- Produces: primitives `Section`, `Row`, `Stepper`, `Toggle`, `Chips`, `Picker`; tab components `AppearanceTab({ snap })`, `ScenesTab({ snap })`, `SpritesTab({ snap })`; shell `SettingsPanel({ snap, onClose })` with tab state.
- Consumes: `BUILTINS` (theme names), `ROTATION_DEFAULT`, `resolveCoreMax`, `GEOMETRY_BOUNDS`, `crunchImageData` — all already imported by the current `SettingsPanel.tsx`.

- [ ] **Step 1: Create the primitives**

Create `src/renderer/src/components/settings/primitives.tsx`:

```tsx
import type { ReactNode } from 'react'

const label = { fontFamily: 'var(--font-pixel)', fontSize: 7, letterSpacing: 1 } as const

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ borderTop: '1px dotted var(--line-soft)', paddingTop: 10, marginTop: 4 }}>
      <div style={{ ...label, marginBottom: 8, color: 'var(--ink-dim)' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

export function Row({ label: text, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 11 }}>
      <span style={{ ...label, width: 64, flexShrink: 0, paddingTop: 3 }}>{text}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export function Stepper({ value, suffix, onDec, onInc }: { value: number | string; suffix?: string; onDec: () => void; onInc: () => void }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={onDec} style={{ fontSize: 10 }}>−</button>
      <span className="dim" style={{ fontSize: 10, minWidth: 64, textAlign: 'center' }}>
        {value}{suffix ?? ''}
      </span>
      <button onClick={onInc} style={{ fontSize: 10 }}>+</button>
    </span>
  )
}

export function Toggle({ on, label: text, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ color: on ? 'var(--clay)' : 'var(--ink)', fontSize: 10 }}>
      {on ? '● ' : '○ '}{text}
    </button>
  )
}

export function Chips({ items, active, onPick }: { items: string[]; active: string | ((s: string) => boolean); onPick: (s: string) => void }) {
  const isOn = (s: string): boolean => (typeof active === 'function' ? active(s) : active === s)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((s) => (
        <Toggle key={s} on={isOn(s)} label={s} onClick={() => onPick(s)} />
      ))}
    </div>
  )
}

export function Picker({ value, options, onPick }: { value: string; options: string[]; onPick: (s: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onPick(e.target.value)}
      style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 4px' }}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: AppearanceTab (theme + frame + audio — rehome only; density/fonts land in Task 4)**

Create `src/renderer/src/components/settings/AppearanceTab.tsx`:

```tsx
import type { HudSnapshot } from '@shared/types'
import { BUILTINS } from '../../theme/builtins'
import { Section, Row, Chips, Toggle } from './primitives'

export function AppearanceTab({ snap }: { snap: HudSnapshot }) {
  const themes = Array.from(new Set([...Object.keys(BUILTINS), ...Object.keys(snap.userThemes)]))
  return (
    <>
      <Section title="THEME">
        <Row label="THEME">
          <Chips items={themes} active={snap.ui.theme} onPick={(name) => window.vault.updateConfig({ ui: { theme: name } })} />
        </Row>
      </Section>
      <Section title="FRAME">
        <Row label="FRAME">
          <Toggle
            on={snap.ui.parade}
            label={snap.ui.parade ? 'on — critters patrol the frame' : 'off'}
            onClick={() => window.vault.updateConfig({ ui: { parade: !snap.ui.parade } })}
          />
        </Row>
      </Section>
    </>
  )
}
```

- [ ] **Step 3: ScenesTab (rotation + speed — rehome only; busy/nap land in Task 4)**

Create `src/renderer/src/components/settings/ScenesTab.tsx`:

```tsx
import type { HudSnapshot } from '@shared/types'
import { ROTATION_DEFAULT } from '../../lib/resolveScenes'
import { Section, Row, Stepper, Chips } from './primitives'

export function ScenesTab({ snap }: { snap: HudSnapshot }) {
  const rotation = snap.ui.scenes?.rotation ?? ROTATION_DEFAULT
  const interval = snap.ui.scenes?.intervalSec ?? 22
  const toggleScene = (name: string): void => {
    const set = new Set(rotation)
    set.has(name) ? set.delete(name) : set.add(name)
    const next = ROTATION_DEFAULT.filter((n) => set.has(n))
    if (next.length === 0) return // never leave the Core with nothing to show
    window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, rotation: next } } })
  }
  const setInterval = (n: number): void =>
    window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, intervalSec: Math.max(3, Math.min(600, n)) } } })
  return (
    <Section title="ROTATION">
      <Row label="SCENES">
        <Chips items={ROTATION_DEFAULT} active={(n) => rotation.includes(n)} onPick={toggleScene} />
      </Row>
      <Row label="SPEED">
        <Stepper value={interval} suffix="s per scene" onDec={() => setInterval(interval - 4)} onInc={() => setInterval(interval + 4)} />
      </Row>
    </Section>
  )
}
```

- [ ] **Step 4: SpritesTab (move the Sprite Studio + Repos verbatim)**

Create `src/renderer/src/components/settings/SpritesTab.tsx`. Move the existing Sprite Studio and Repos blocks out of `SettingsPanel.tsx` **verbatim** — the current file's `crunch` helper (lines 12-23), `SpritePreview` component (lines 25-47), the `draft`/`fileRef` state + `onFile` (lines 50-60), the SPRITE STUDIO block (lines 174-226), and the REPOS block (lines 228-247). Wrap them in this component (which owns the state that used to live in `SettingsPanel`):

```tsx
import { useRef, useState } from 'react'
import type { CustomSprite, HudSnapshot } from '@shared/types'
import { crunchImageData } from '../../lib/quantize'
import { Section } from './primitives'

// ---- move `crunch(img, size)` and `SpritePreview({grid, cell})` here verbatim
//      from the old SettingsPanel.tsx (adjust the quantize import path to
//      '../../lib/quantize' as above) ----

export function SpritesTab({ snap }: { snap: HudSnapshot }) {
  const [draft, setDraft] = useState<{ name: string; grid: string[][] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const onFile = (f: File): void => {
    const img = new Image()
    img.onload = () => setDraft({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 16) || 'sprite', grid: crunch(img) })
    img.src = URL.createObjectURL(f)
  }
  return (
    <>
      <Section title="SPRITE STUDIO">
        {/* move the SPRITE STUDIO inner markup (old lines 176-225) here verbatim */}
      </Section>
      <Section title="REPOS">
        {/* move the REPOS inner markup (old lines 229-246) here verbatim */}
      </Section>
    </>
  )
}
```

Preserve every attribute and handler exactly as in the original — this is a move, not a rewrite. The only edits are the import paths (now `../../lib/...`) and wrapping each block in `<Section>` instead of the old `borderTop` divs.

- [ ] **Step 5: Rewrite `SettingsPanel.tsx` into the tabbed shell**

Replace the entire body of `src/renderer/src/components/SettingsPanel.tsx` with the shell (the `crunch`/`SpritePreview`/sprite state are gone — they moved to SpritesTab):

```tsx
import { useState } from 'react'
import type { HudSnapshot } from '@shared/types'
import { AppearanceTab } from './settings/AppearanceTab'
import { ScenesTab } from './settings/ScenesTab'
import { SpritesTab } from './settings/SpritesTab'

type Tab = 'appearance' | 'layout' | 'scenes' | 'sprites' | 'share'
const TABS: Tab[] = ['appearance', 'layout', 'scenes', 'sprites', 'share']

export function SettingsPanel({ snap, onClose }: { snap: HudSnapshot; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('appearance')
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ width: 'min(640px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <header className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Settings</span>
          <span className="corner" style={{ cursor: 'pointer' }} onClick={onClose}>✕ close</span>
        </header>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px dotted var(--line-soft)', paddingBottom: 8 }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, letterSpacing: 1, padding: '4px 8px', color: tab === t ? 'var(--clay)' : 'var(--ink)' }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tab === 'appearance' && <AppearanceTab snap={snap} />}
          {tab === 'scenes' && <ScenesTab snap={snap} />}
          {tab === 'sprites' && <SpritesTab snap={snap} />}
          {tab === 'layout' && <div className="dim" style={{ fontSize: 11, padding: 8 }}>layout manager — coming in this build</div>}
          {tab === 'share' && <div className="dim" style={{ fontSize: 11, padding: 8 }}>share — coming in this build</div>}
        </div>
      </div>
    </div>
  )
}
```

(The `layout` and `share` tabs are placeholders here; Tasks 3 and 5 replace those two lines with `<LayoutTab>` / `<ShareTab>`. This keeps Task 2 shippable and green on its own.)

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, typecheck clean, build exit 0.

- [ ] **Step 7: Manual smoke (DOM)**

In `npm run dev`: open Settings — tabs render; APPEARANCE shows theme chips that **wrap** (no left/right clipping) even at a narrow window; SCENES shows rotation + speed; SPRITES shows the studio + repos and a drop still crunches a sprite; the panel scrolls, never overflows horizontally. Report observations.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: tabbed Settings shell + primitives; rehome theme/scenes/sprites (fixes clipping)"
```

---

## Task 3: Layout tab — the visual zone manager

Adds the headline no-editor capability: manage D's zones with clicks. Replaces the `layout` placeholder in the shell.

**Files:**
- Create: `src/renderer/src/components/settings/LayoutTab.tsx`
- Modify: `src/renderer/src/components/SettingsPanel.tsx` (swap the placeholder for `<LayoutTab snap={snap} />` + import)

**Interfaces:**
- Consumes: `resolveLayout`, `DEFAULT_ZONES` from `../../lib/resolveLayout`; `resolveGeometry`, `GEOMETRY_BOUNDS` from `../../lib/resolveGeometry`; primitives from `./primitives`.
- Produces: `LayoutTab({ snap })`.

**Module id source (avoids a circular import):** the registered module ids come from `DEFAULT_ZONES.flat()` (exported from `resolveLayout.ts`) — it already contains every module, so `LayoutTab` does NOT import from `App.tsx` (which would create an `App → SettingsPanel → LayoutTab → App` cycle). No `App.tsx` change is needed.

- [ ] **Step 1: Implement LayoutTab**

Create `src/renderer/src/components/settings/LayoutTab.tsx`:

```tsx
import type { HudSnapshot } from '@shared/types'
import { resolveLayout, DEFAULT_ZONES } from '../../lib/resolveLayout'
import { resolveGeometry, GEOMETRY_BOUNDS } from '../../lib/resolveGeometry'
import { resolveModule } from '../../modules/resolve'
import { Section, Row, Stepper, Toggle, Picker } from './primitives'

// every module appears in the canonical default layout — use it as the id list
const MODULE_IDS = Array.from(new Set(DEFAULT_ZONES.flat()))

export function LayoutTab({ snap }: { snap: HudSnapshot }) {
  const validIds = new Set(MODULE_IDS)
  const zones = resolveLayout(snap.ui.layout, validIds)
  const coreZone = zones.findIndex((z) => z.includes('core'))
  const geo = resolveGeometry(snap.ui.geometry, zones.length, coreZone)
  const [wmin, wmax] = GEOMETRY_BOUNDS.zoneWidth

  const writeZones = (nextZones: string[][], nextGeo?: { zoneWidths?: number[]; flexZone?: number }): void =>
    window.vault.updateConfig({
      ui: { layout: { zones: nextZones }, geometry: { ...snap.ui.geometry, zoneWidths: geo.zoneWidths, flexZone: geo.flexZone, ...nextGeo } }
    })

  const moveModule = (id: string, toZone: number): void => {
    const next = zones.map((z) => z.filter((m) => m !== id))
    next[toZone].push(id)
    writeZones(next)
  }
  const setWidth = (i: number, px: number): void => {
    const zoneWidths = geo.zoneWidths.slice()
    zoneWidths[i] = Math.max(wmin, Math.min(wmax, px))
    window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, zoneWidths, flexZone: geo.flexZone } } })
  }
  const setFlex = (i: number): void =>
    window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, zoneWidths: geo.zoneWidths, flexZone: i } } })
  const addZone = (): void => writeZones([...zones, []], { zoneWidths: [...geo.zoneWidths, 260] })
  const removeZone = (i: number): void => {
    if (zones.length <= 1) return
    const next = zones.filter((_, j) => j !== i)
    const zoneWidths = geo.zoneWidths.filter((_, j) => j !== i)
    const flexZone = Math.max(0, Math.min(next.length - 1, i < geo.flexZone ? geo.flexZone - 1 : geo.flexZone))
    writeZones(next, { zoneWidths, flexZone })
  }
  const toggleModule = (id: string, on: boolean): void =>
    window.vault.updateConfig({ ui: { modules: { ...snap.ui.modules, [id]: { ...snap.ui.modules?.[id], enabled: on } } } })
  const setCoreMax = (px: number): void => {
    const [cmin, cmax] = GEOMETRY_BOUNDS.coreMax
    window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, coreMax: Math.max(cmin, Math.min(cmax, px)) } } })
  }

  const zoneNames = zones.map((_, i) => String(i))
  return (
    <>
      <Section title="ZONES">
        {zones.map((z, i) => (
          <div key={i} style={{ border: '1px solid var(--line-soft)', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="dim" style={{ fontSize: 10 }}>zone {i}{i === geo.flexZone ? ' · flex' : ''}</span>
              <button onClick={() => removeZone(i)} disabled={zones.length <= 1} style={{ fontSize: 10, color: 'var(--danger)' }}>✕ zone</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {z.length === 0 && <span className="dim" style={{ fontSize: 10 }}>empty</span>}
              {z.map((id) => (
                <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  <span style={{ color: 'var(--ink)' }}>{id}</span>
                  <Picker value={String(i)} options={zoneNames} onPick={(t) => moveModule(id, Number(t))} />
                </span>
              ))}
            </div>
            <Row label="WIDTH">
              {i === geo.flexZone ? (
                <span className="dim" style={{ fontSize: 10 }}>flexes to fill</span>
              ) : (
                <Stepper value={geo.zoneWidths[i]} suffix="px" onDec={() => setWidth(i, geo.zoneWidths[i] - 20)} onInc={() => setWidth(i, geo.zoneWidths[i] + 20)} />
              )}
              <Toggle on={i === geo.flexZone} label="flex" onClick={() => setFlex(i)} />
            </Row>
          </div>
        ))}
        <button onClick={addZone} style={{ fontSize: 10 }}>+ add zone</button>
      </Section>
      <Section title="PANELS">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MODULE_IDS.map((id) => {
            const { enabled } = resolveModule({}, snap.ui.modules?.[id])
            return <Toggle key={id} on={enabled} label={id} onClick={() => toggleModule(id, !enabled)} />
          })}
        </div>
      </Section>
      <Section title="CORE SIZE">
        <Row label="CORE">
          <Stepper value={geo.coreMax} suffix="px" onDec={() => setCoreMax(geo.coreMax - 20)} onInc={() => setCoreMax(geo.coreMax + 20)} />
          <button onClick={() => window.vault.updateConfig({ ui: { geometry: {} } })} style={{ fontSize: 10 }}>reset all sizes</button>
        </Row>
      </Section>
    </>
  )
}
```

(The **CORE SIZE** section restores the coreMax stepper from sub-project C's SIZE row — it caps the Core canvas width independent of its zone's width. "reset all sizes" clears `ui.geometry` back to defaults, exactly as the old reset did.)

- [ ] **Step 2: Wire it into the shell**

In `SettingsPanel.tsx`, add `import { LayoutTab } from './settings/LayoutTab'` and replace the `layout` placeholder line with:

```tsx
          {tab === 'layout' && <LayoutTab snap={snap} />}
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass / clean / exit 0.

- [ ] **Step 4: Manual smoke (DOM)**

In `npm run dev`: LAYOUT tab lists each zone; move a module to another zone via its dropdown and watch the HUD update; step a zone's width and see it resize; toggle flex to another zone; add a zone, populate it, remove it; toggle a panel off in PANELS and see it vanish. Confirm these match what dragging/`+ ZONE` produce. Report observations.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Layout tab — visual zone manager (move/width/flex/add/remove) + panel on-off"
```

---

## Task 4: Scenes busy/nap + Appearance density/fonts

Fills the JSON-only gaps in the existing tabs.

**Files:**
- Modify: `src/renderer/src/components/CoreScene.tsx` (export `SCENE_NAMES`), `settings/ScenesTab.tsx`, `settings/AppearanceTab.tsx`

**Interfaces:**
- Consumes: `SCENE_NAMES: string[]` (newly exported from CoreScene); `Density` from `@shared/types`; primitives `Row`, `Picker`, `Chips`.

- [ ] **Step 1: Export the scene name list**

In `src/renderer/src/components/CoreScene.tsx`, change `const SCENE_NAMES = Object.keys(SCENE_REGISTRY)` to `export const SCENE_NAMES = Object.keys(SCENE_REGISTRY)`.

- [ ] **Step 2: Busy + nap pickers in ScenesTab**

In `settings/ScenesTab.tsx`, add the import and two rows. Add to imports:

```ts
import { SCENE_NAMES } from '../CoreScene'
import { Picker } from './primitives'
```

Inside the `<Section title="ROTATION">`, after the SPEED row, add:

```tsx
      <Row label="BUSY">
        <Picker
          value={snap.ui.scenes?.busy ?? 'disco'}
          options={SCENE_NAMES}
          onPick={(busy) => window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, busy } } })}
        />
        <span className="dim" style={{ fontSize: 10 }}>plays while a command runs</span>
      </Row>
      <Row label="NAP">
        <Picker
          value={snap.ui.scenes?.nap ?? 'nap'}
          options={SCENE_NAMES}
          onPick={(nap) => window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, nap } } })}
        />
        <span className="dim" style={{ fontSize: 10 }}>plays after 90min idle</span>
      </Row>
```

- [ ] **Step 3: Density + fonts in AppearanceTab**

Built-ins are immutable; density/font edits target the active theme only when it's a user theme (`snap.userThemes[snap.ui.theme]`). Add to `AppearanceTab.tsx` imports:

```ts
import type { Density } from '@shared/types'
import { Row, Picker } from './primitives'
```

Add a helper + a DENSITY/FONTS section. Inside the component, before `return`:

```tsx
  const activeName = snap.ui.theme
  const userDef = snap.userThemes[activeName]
  const editable = !!userDef // built-ins (terminal/paper) are not in userThemes
  const patchTheme = (patch: Record<string, unknown>): void => {
    if (!userDef) return
    window.vault.updateConfig({ ui: { themes: { ...snap.ui.themes, [activeName]: { ...userDef, ...patch } } } })
  }
  const FONTS = ['', 'ui-monospace', 'Menlo', 'Consolas', 'Courier New']
```

And a new `<Section title="STYLE">` after the THEME section:

```tsx
      <Section title="STYLE">
        <Row label="DENSITY">
          {editable ? (
            <Chips
              items={['compact', 'cozy', 'airy']}
              active={userDef.density ?? 'cozy'}
              onPick={(d) => patchTheme({ density: d as Density })}
            />
          ) : (
            <span className="dim" style={{ fontSize: 10 }}>{`${activeName} is built-in — copy it to a user theme to edit`}</span>
          )}
        </Row>
        {editable && (
          <Row label="MONO">
            <Picker value={userDef.fonts?.mono ?? ''} options={FONTS} onPick={(mono) => patchTheme({ fonts: { ...userDef.fonts, mono } })} />
            <span className="dim" style={{ fontSize: 10 }}>front of the mono stack</span>
          </Row>
        )}
      </Section>
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass / clean / exit 0.

- [ ] **Step 5: Manual smoke (DOM)**

In `npm run dev`: SCENES tab has BUSY + NAP dropdowns — pick a busy scene, run a command, see it; APPEARANCE STYLE shows DENSITY chips when a user theme (midnight/amber) is active and re-spaces the HUD, and shows the read-only note when terminal/paper is active. Report observations.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: busy/nap scene pickers + density/font controls for user themes"
```

---

## Task 5: Share tab — export / import a rice

The r/unixporn loop, on top of Task 1's `lib/rice.ts`, using existing IPC only.

**Files:**
- Create: `src/renderer/src/components/settings/ShareTab.tsx`
- Modify: `src/renderer/src/components/SettingsPanel.tsx` (swap the `share` placeholder for `<ShareTab snap={snap} />` + import)

**Interfaces:**
- Consumes: `buildRice`, `parseRice` from `../../lib/rice`; primitives `Section`; `window.vault.updateConfig` + `window.vault.saveSprite`.
- Produces: `ShareTab({ snap })`.

- [ ] **Step 1: Implement ShareTab**

Create `src/renderer/src/components/settings/ShareTab.tsx`:

```tsx
import { useState } from 'react'
import type { HudSnapshot } from '@shared/types'
import { buildRice, parseRice } from '../../lib/rice'
import { Section } from './primitives'

export function ShareTab({ snap }: { snap: HudSnapshot }) {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')

  const exportRice = (): string => JSON.stringify(buildRice(snap), null, 2)

  const copy = (): void => {
    const out = exportRice()
    navigator.clipboard?.writeText(out).then(
      () => setMsg('copied to clipboard'),
      () => setMsg('copy failed — use download')
    )
  }
  const download = (): void => {
    const blob = new Blob([exportRice()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${snap.ui.theme || 'vault'}.rice.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('downloaded')
  }
  const importRice = (): void => {
    const res = parseRice(text)
    if (!res.ok) {
      setMsg(`import failed — ${res.error}`)
      return
    }
    const b = res.bundle
    window.vault.updateConfig({ ui: { ...b.ui, themes: { ...(snap.ui.themes ?? {}), ...(b.themes ?? {}) } } })
    for (const s of b.sprites ?? []) window.vault.saveSprite(s)
    setMsg('rice applied — your HUD now matches it')
  }

  return (
    <>
      <Section title="EXPORT">
        <div className="dim" style={{ fontSize: 10 }}>bundle your whole look — theme, layout, scenes, sizes, sprites — into one file to share.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={copy} style={{ fontSize: 10 }}>· copy to clipboard</button>
          <button onClick={download} style={{ fontSize: 10 }}>· download .rice.json</button>
        </div>
      </Section>
      <Section title="IMPORT">
        <div className="dim" style={{ fontSize: 10 }}>paste someone's rice below and apply — your HUD becomes their setup, live.</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="paste a .rice.json here"
          style={{ width: '100%', height: 90, background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: 6, resize: 'vertical' }}
        />
        <button onClick={importRice} disabled={!text.trim()} style={{ fontSize: 10 }}>· apply rice</button>
      </Section>
      {msg && <div className="clay" style={{ fontSize: 10, marginTop: 6 }}>{msg}</div>}
    </>
  )
}
```

- [ ] **Step 2: Wire it into the shell**

In `SettingsPanel.tsx`, add `import { ShareTab } from './settings/ShareTab'` and replace the `share` placeholder line with:

```tsx
          {tab === 'share' && <ShareTab snap={snap} />}
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass / clean / exit 0.

- [ ] **Step 4: Manual smoke (DOM)**

In `npm run dev`: SHARE tab — copy exports a JSON (paste into the import box of a fresh look and Apply reproduces it: theme, zones, scenes, sprites all change live); paste garbage → "import failed — …" and nothing changes. Report observations.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Share tab — export/import a self-contained rice file"
```

---

## Self-Review

- **Spec coverage:** tabbed shell + sizing fix (T2) ✓; wrapping Chips kills theme clip (T2 §1-2) ✓; primitives vocabulary (T2 §1) ✓; zone manager: move/width/flex/add/remove + panel on-off (T3) ✓; busy/nap pickers (T4) ✓; density/fonts for user themes, built-ins read-only (T4 §3) ✓; Sprites/Repos rehomed (T2 §4) ✓; RiceBundle + pure build/parse fail-soft (T1) ✓; export copy/download + import-via-existing-IPC, no partial apply (T5, T1) ✓; live-apply + shallow-merge spreads (all tasks) ✓; reuse D resolvers for layout math (T3) ✓.
- **Placeholders:** none — every code step has complete code except the deliberate "move verbatim" in T2 §4 (a relocation of existing, in-repo code, pointed to by line range) and the two intentional shell placeholders replaced in T3/T5.
- **Type consistency:** `RiceBundle {v,ui,themes?,sprites?}`, `buildRice(snap)`, `parseRice(text)→{ok,...}`, primitives signatures, `MODULE_IDS`, `SCENE_NAMES` — all consistent T1→T5. `resolveGeometry(cfg, zoneCount, coreZone?)` and `resolveLayout(cfg, validIds)` match their D signatures.
- **Ordering:** T1 additive/green; T2 shell shippable with placeholders; T3/T4/T5 each additive on the shell. Each ends green + testable.
