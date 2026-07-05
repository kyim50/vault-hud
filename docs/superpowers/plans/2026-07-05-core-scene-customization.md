# Core Scene Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users curate the Core's rotating scenes from `config.ui.scenes` (which scenes rotate, their order, per-scene duration, and the busy/nap state scenes), plus a Settings checklist + interval control.

**Architecture:** Replace CoreScene's index-keyed `SCENES`/`DISCO`/`HORIZONS` constants with a name-keyed `SCENE_REGISTRY`. A pure `resolveScenes()` turns the config slice into a resolved rotation list + interval + busy/nap names (fully unit-tested). CoreScene reads the resolved config each frame via a ref; the loading transition takes scene draw functions instead of indices.

**Tech Stack:** TypeScript, React 19, Electron, Vitest (`environment: 'node'` — the pure resolver is unit-tested; CoreScene/Settings changes are verified via typecheck + build, as they touch canvas/DOM).

## Global Constraints

- **No Claude co-author trailer in any commit.** End commit messages at their own body.
- **Branch:** all work stays on the existing `vaultfetch` branch. Do not merge, do not create branches.
- **Test env is `node`:** only the pure `resolveScenes` gets unit tests. CoreScene/Settings are verified with `npm run typecheck` + `npm run build` (do not add jsdom).
- **Behavior with no config must be identical to today:** all 8 scenes, 22s each (FPS = 12 → 264 frames), disco when busy, nap when idle.
- **Fail-soft:** invalid scene names are dropped; an empty rotation falls back to all 8 (the Core must never have nothing to show).
- **Do NOT launch the Electron GUI** (`npm run dev`) in a subagent — the controller does the visual verification.
- Verify `npm test` + `npm run typecheck` (+ `npm run build` where noted) green before each commit.

---

## File Structure

**Create:**
- `src/renderer/src/lib/resolveScenes.ts` — pure resolver + `ROTATION_DEFAULT` (canonical scene-name list, shared by CoreScene and Settings)
- `tests/resolveScenes.test.ts`

**Modify:**
- `src/shared/types.ts` — add `SceneConfig`; add `UiConfig.scenes?`
- `src/renderer/src/components/CoreScene.tsx` — `SCENE_REGISTRY` replaces `SCENES`/`DISCO`/`HORIZONS`; loop driven by resolved config; `drawLoadingTransition` takes draw fns; new `scenes` prop
- `src/renderer/src/hud/App.tsx` — pass `scenes={snap.ui.scenes}` to `<CoreScene>`
- `src/renderer/src/components/SettingsPanel.tsx` — Scenes checklist + interval control

---

## Task 1: `resolveScenes` pure resolver + config types

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/renderer/src/lib/resolveScenes.ts`
- Test: `tests/resolveScenes.test.ts`

**Interfaces:**
- Produces:
  - (shared) `SceneConfig = { rotation?: string[]; intervalSec?: number; busy?: string; nap?: string }`; `UiConfig.scenes?: SceneConfig`
  - (resolveScenes) `ROTATION_DEFAULT: string[]` = `['meadow','surf','garden','disco','globe','night','rain','rooftop']`; `ResolvedScenes = { rotation: string[]; intervalFrames: number; busy: string; nap: string }`; `resolveScenes(cfg: SceneConfig | undefined, validNames: string[], defaults: string[], fps: number): ResolvedScenes`

- [ ] **Step 1: Add shared types**

In `src/shared/types.ts`, add near `ModuleConfig`:

```ts
export interface SceneConfig {
  rotation?: string[] // scenes that cycle, in order
  intervalSec?: number // seconds per scene
  busy?: string // scene shown while a command runs
  nap?: string // scene shown after 90min idle
}
```

Add `scenes` to `UiConfig`:

```ts
export interface UiConfig {
  theme: string
  parade: boolean
  layout?: PanelLayout
  audio?: AudioConfig
  modules?: Record<string, ModuleConfig>
  themes?: Record<string, ThemeDef>
  scenes?: SceneConfig
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/resolveScenes.test.ts
import { describe, it, expect } from 'vitest'
import { resolveScenes, ROTATION_DEFAULT } from '../src/renderer/src/lib/resolveScenes'

const VALID = ['meadow', 'surf', 'garden', 'disco', 'globe', 'night', 'rain', 'rooftop', 'nap']

describe('resolveScenes', () => {
  it('no config → all 8 in order, 22s (264 frames), disco/nap', () => {
    const r = resolveScenes(undefined, VALID, ROTATION_DEFAULT, 12)
    expect(r.rotation).toEqual(ROTATION_DEFAULT)
    expect(r.intervalFrames).toBe(264)
    expect(r.busy).toBe('disco')
    expect(r.nap).toBe('nap')
  })
  it('drops invalid names, keeps order', () => {
    expect(resolveScenes({ rotation: ['meadow', 'nope', 'night'] }, VALID, ROTATION_DEFAULT, 12).rotation).toEqual(['meadow', 'night'])
  })
  it('empty or all-invalid rotation falls back to defaults', () => {
    expect(resolveScenes({ rotation: [] }, VALID, ROTATION_DEFAULT, 12).rotation).toEqual(ROTATION_DEFAULT)
    expect(resolveScenes({ rotation: ['nope', 'zzz'] }, VALID, ROTATION_DEFAULT, 12).rotation).toEqual(ROTATION_DEFAULT)
  })
  it('clamps intervalSec to [3,600] then × fps', () => {
    expect(resolveScenes({ intervalSec: 1 }, VALID, ROTATION_DEFAULT, 12).intervalFrames).toBe(36) // 3×12
    expect(resolveScenes({ intervalSec: 9999 }, VALID, ROTATION_DEFAULT, 12).intervalFrames).toBe(7200) // 600×12
    expect(resolveScenes({ intervalSec: 10 }, VALID, ROTATION_DEFAULT, 12).intervalFrames).toBe(120)
  })
  it('busy/nap: valid custom respected, invalid falls back', () => {
    expect(resolveScenes({ busy: 'night', nap: 'meadow' }, VALID, ROTATION_DEFAULT, 12).busy).toBe('night')
    expect(resolveScenes({ busy: 'night', nap: 'meadow' }, VALID, ROTATION_DEFAULT, 12).nap).toBe('meadow')
    expect(resolveScenes({ busy: 'nope' }, VALID, ROTATION_DEFAULT, 12).busy).toBe('disco')
    expect(resolveScenes({ nap: 'nope' }, VALID, ROTATION_DEFAULT, 12).nap).toBe('nap')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/resolveScenes.test.ts`
Expected: FAIL — cannot find module `resolveScenes`.

- [ ] **Step 4: Write `resolveScenes.ts`**

```ts
// src/renderer/src/lib/resolveScenes.ts
import type { SceneConfig } from '@shared/types'

// canonical rotation order — shared by CoreScene (registry) and Settings (checklist)
export const ROTATION_DEFAULT = ['meadow', 'surf', 'garden', 'disco', 'globe', 'night', 'rain', 'rooftop']

export interface ResolvedScenes {
  rotation: string[]
  intervalFrames: number
  busy: string
  nap: string
}

// pure: fold a partial scene config into a fully-resolved, always-valid form.
// rotation is never empty; interval is clamped; busy/nap fall back to defaults.
export function resolveScenes(
  cfg: SceneConfig | undefined,
  validNames: string[],
  defaults: string[],
  fps: number
): ResolvedScenes {
  const valid = new Set(validNames)
  const requested = (cfg?.rotation ?? []).filter((n) => valid.has(n))
  const rotation = requested.length > 0 ? requested : defaults
  const sec = Math.max(3, Math.min(600, cfg?.intervalSec ?? 22))
  return {
    rotation,
    intervalFrames: Math.round(sec * fps),
    busy: cfg?.busy && valid.has(cfg.busy) ? cfg.busy : 'disco',
    nap: cfg?.nap && valid.has(cfg.nap) ? cfg.nap : 'nap'
  }
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run tests/resolveScenes.test.ts && npm run typecheck`
Expected: 5 tests PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/renderer/src/lib/resolveScenes.ts tests/resolveScenes.test.ts
git commit -m "feat: SceneConfig type + resolveScenes pure resolver"
```

---

## Task 2: CoreScene name-keyed registry + config-driven rotation

**Files:**
- Modify: `src/renderer/src/components/CoreScene.tsx`
- Modify: `src/renderer/src/hud/App.tsx`

**Interfaces:**
- Consumes: `resolveScenes`, `ROTATION_DEFAULT`, `ResolvedScenes` from `../lib/resolveScenes`; `SceneConfig` from `@shared/types`
- Produces: `CoreScene` gains a `scenes?: SceneConfig` prop

*(Manual verification — canvas rendering. Gates: typecheck + build. No unit test.)*

- [ ] **Step 1: Add imports and the `SceneFn` type**

At the top of `CoreScene.tsx`, add to the React import (currently `import { useEffect, useRef } from 'react'`) — no new React hooks needed (we use the existing ref pattern). Add:

```ts
import { resolveScenes, ROTATION_DEFAULT } from '../lib/resolveScenes'
import type { LinkGraph, Mood, SceneConfig } from '@shared/types'
```

(The `Mood`/`LinkGraph` import already exists — just add `SceneConfig` to it.)

Add the scene-function type near the top (after the `Ctx` type alias / `const W`/`H`):

```ts
type SceneFn = (ctx: Ctx, f: number, blink: boolean) => void
interface SceneDef { name: string; draw: SceneFn; horizon?: number }
```

- [ ] **Step 2: Replace the `SCENES`/`DISCO`/`HORIZONS` constants with the registry**

Find (around line 624):

```ts
const SCENES = [sceneMeadow, sceneSurf, sceneGarden, sceneDisco, sceneGlobe, sceneNight, sceneRain, sceneRooftop]
const DISCO = 3
// scenes with a walkable ground line — loot props furnish these
const HORIZONS: Record<number, number> = { 0: 90, 2: 92, 3: 94, 5: 92, 6: 92, 7: 88 }
```

Replace with (horizon values carried over verbatim; `sceneNap` joins the registry):

```ts
// name-keyed registry: config references names, not fragile array indices.
// horizon = walkable ground line for loot props (undefined = no ground scene).
const SCENE_REGISTRY: Record<string, SceneDef> = {
  meadow: { name: 'meadow', draw: sceneMeadow, horizon: 90 },
  surf: { name: 'surf', draw: sceneSurf },
  garden: { name: 'garden', draw: sceneGarden, horizon: 92 },
  disco: { name: 'disco', draw: sceneDisco, horizon: 94 },
  globe: { name: 'globe', draw: sceneGlobe },
  night: { name: 'night', draw: sceneNight, horizon: 92 },
  rain: { name: 'rain', draw: sceneRain, horizon: 92 },
  rooftop: { name: 'rooftop', draw: sceneRooftop, horizon: 88 },
  nap: { name: 'nap', draw: sceneNap }
}
const SCENE_NAMES = Object.keys(SCENE_REGISTRY)
```

- [ ] **Step 3: Change `drawLoadingTransition` to take draw functions**

In the `drawLoadingTransition` signature (around line 668), change the two index params:

```ts
  fromScene: number,
  toScene: number,
```

to:

```ts
  fromDraw: SceneFn,
  toDraw: SceneFn,
```

Inside its body, change the two calls:
- `SCENES[fromScene](fromCtx, frozenF, false)` → `fromDraw(fromCtx, frozenF, false)`
- `SCENES[toScene](toCtx, liveF, blink)` → `toDraw(toCtx, liveF, blink)`

- [ ] **Step 4: Add the `scenes` prop + resolved ref**

In the `CoreScene({ ... })` destructure add `scenes`, and in the prop type add `scenes?: SceneConfig`:

```ts
export function CoreScene({
  usagePercent,
  busy,
  mood,
  loot,
  graph,
  chart,
  scenes
}: {
  usagePercent: number
  busy: boolean
  mood: Mood
  loot: string[]
  graph: LinkGraph
  chart: boolean
  scenes?: SceneConfig
}) {
```

Alongside the other refs (after `chartRef.current = chart`), add:

```ts
  const scn = resolveScenes(scenes, SCENE_NAMES, ROTATION_DEFAULT, FPS)
  const scnRef = useRef(scn)
  scnRef.current = scn
```

- [ ] **Step 5: Drive the loop from the resolved config**

Replace the block starting `const slot = Math.floor(frame / SCENE_FRAMES)` (line 996) through the closing of the direct-draw `else if` (line 1035), i.e. the whole scene-selection + draw section, with:

```ts
      const sceneFrames = scnRef.current.intervalFrames
      const rot = scnRef.current.rotation
      const slot = Math.floor(frame / sceneFrames)
      const entry = busyRef.current ? SCENE_REGISTRY[scnRef.current.busy] : SCENE_REGISTRY[rot[slot % rot.length]]
      const napping = !busyRef.current && moodRef.current === 'napping'
      const inScene = tf - slot * sceneFrames
      if (dissolve < 1) {
        if (!napping && inScene < TRANS_FRAMES && slot > 0 && !busyRef.current) {
          const prevEntry = SCENE_REGISTRY[rot[(slot - 1) % rot.length]]
          const blinkEvery = usageRef.current > 80 ? 24 : 48
          const frozenF = slot * sceneFrames - 1 // last frame of the outgoing scene
          drawLoadingTransition(
            sctx,
            bufFrom,
            bufTo,
            bufLoad,
            cFrom,
            cTo,
            cLoad,
            prevEntry.draw,
            entry.draw,
            frozenF,
            frame,
            frame % blinkEvery >= blinkEvery - 6,
            inScene / TRANS_FRAMES
          )
          lastFrame = -1
        } else if (frame !== lastFrame) {
          const blinkEvery = usageRef.current > 80 ? 24 : 48
          sctx.clearRect(0, 0, W, H)
          if (napping) {
            SCENE_REGISTRY[scnRef.current.nap].draw(sctx, frame, false)
          } else {
            entry.draw(sctx, frame, frame % blinkEvery >= blinkEvery - 6)
            if (entry.horizon !== undefined) drawLoot(sctx, lootRef.current, entry.horizon, frame)
          }
          lastFrame = frame
        }
      }
```

Then delete the now-unused module constant `SCENE_FRAMES` (line 16, `const SCENE_FRAMES = 22 * FPS`) — grep to confirm it has no remaining references: `grep -n "SCENE_FRAMES" src/renderer/src/components/CoreScene.tsx` must return nothing.

- [ ] **Step 6: Pass the prop from App**

In `src/renderer/src/hud/App.tsx`, add the `scenes` prop to the `<CoreScene>` element (around line 273):

```tsx
          <CoreScene
            usagePercent={snap.usage.percent}
            busy={snap.commands.some((c) => c.status.state === 'running')}
            mood={snap.mood}
            loot={snap.loot}
            graph={snap.graph}
            chart={chart}
            scenes={snap.ui.scenes}
          />
```

- [ ] **Step 7: Verify — grep, typecheck, build**

Run:
```bash
grep -nE '\b(SCENES|DISCO|HORIZONS|SCENE_FRAMES)\b' src/renderer/src/components/CoreScene.tsx || echo "OLD CONSTS GONE"
npm run typecheck && npm run build
```
Expected: `OLD CONSTS GONE`, typecheck passes, build exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/CoreScene.tsx src/renderer/src/hud/App.tsx
git commit -m "feat: config-driven Core scene rotation via name-keyed registry"
```

---

## Task 3: Settings — scene checklist + interval control

**Files:**
- Modify: `src/renderer/src/components/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `ROTATION_DEFAULT` from `../lib/resolveScenes`; `snap.ui.scenes`; the existing `window.vault.updateConfig` + `row`/`label` styles

*(Manual verification. Gate: typecheck + build.)*

- [ ] **Step 1: Add the import**

At the top of `SettingsPanel.tsx`, add:

```ts
import { ROTATION_DEFAULT } from '../lib/resolveScenes'
```

- [ ] **Step 2: Add the Scenes section**

Immediately after the `THEME` `<div style={row}>…</div>` block (the theme picker), add a scenes checklist + interval row. `rotation` reflects current membership (default = all 8); toggling writes the canonical-ordered subset; never allow zero scenes; every write spreads `snap.ui.scenes` so `intervalSec`/`busy`/`nap` survive the shallow `updateConfig` merge:

```tsx
        <div style={row}>
          <span style={{ ...label, width: 70 }}>SCENES</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ROTATION_DEFAULT.map((name) => {
              const rotation = snap.ui.scenes?.rotation ?? ROTATION_DEFAULT
              const on = rotation.includes(name)
              const toggle = (): void => {
                const set = new Set(rotation)
                if (on) set.delete(name)
                else set.add(name)
                const next = ROTATION_DEFAULT.filter((n) => set.has(n))
                if (next.length === 0) return // never leave the Core with nothing to show
                window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, rotation: next } } })
              }
              return (
                <button key={name} onClick={toggle} style={{ color: on ? 'var(--clay)' : 'var(--ink)', fontSize: 10 }}>
                  {on ? '● ' : '○ '}{name}
                </button>
              )
            })}
          </div>
        </div>

        <div style={row}>
          <span style={{ ...label, width: 70 }}>SPEED</span>
          <button
            onClick={() =>
              window.vault.updateConfig({
                ui: { scenes: { ...snap.ui.scenes, intervalSec: Math.max(3, (snap.ui.scenes?.intervalSec ?? 22) - 4) } }
              })
            }
            style={{ fontSize: 10 }}
          >
            −
          </button>
          <span className="dim" style={{ fontSize: 10 }}>{snap.ui.scenes?.intervalSec ?? 22}s per scene</span>
          <button
            onClick={() =>
              window.vault.updateConfig({
                ui: { scenes: { ...snap.ui.scenes, intervalSec: Math.min(600, (snap.ui.scenes?.intervalSec ?? 22) + 4) } }
              })
            }
            style={{ fontSize: 10 }}
          >
            +
          </button>
        </div>
```

- [ ] **Step 3: Verify — typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: passes, build exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/SettingsPanel.tsx
git commit -m "feat: Settings scene checklist + rotation speed control"
```

---

## Final verification

- [ ] `npm test` — all suites pass (resolveScenes + existing 130).
- [ ] `npm run typecheck` — zero errors.
- [ ] `npm run build` — exits 0.
- [ ] `git log --oneline` shows 3 new commits, none with a `Co-Authored-By` trailer (`git log <base>..HEAD --format='%b' | grep -i co-author` returns nothing).
- [ ] Manual (`npm run dev`): uncheck scenes in Settings → only checked scenes cycle; adjust SPEED → rotation timing changes; set `ui.scenes.busy`/`nap` in `~/.vault-hud/config.json` → those scenes show on command-run / after 90min idle; confirm the loading transition still plays between arbitrary scene pairs.

## Self-review notes (addressed)

- **Spec coverage:** registry (T2), `ui.scenes` config + resolver with all rules (T1), CoreScene wiring incl. transition-takes-draw-fns + horizon-from-registry + nap-from-registry (T2), Settings checklist + interval (T3). All covered.
- **No-config parity:** `resolveScenes(undefined, …)` returns the exact current behavior (all 8, 264 frames, disco/nap) — Task 1 test locks it.
- **Type consistency:** `SceneConfig` (shared, partial) vs `ResolvedScenes` (resolver, filled); `SceneFn`/`SceneDef` local to CoreScene; `ROTATION_DEFAULT` single-sourced in `resolveScenes.ts` and imported by both CoreScene and Settings.
- **Merge caveat:** every Settings write spreads `snap.ui.scenes` (Task 3) because `updateConfig` shallow-merges `ui`.
