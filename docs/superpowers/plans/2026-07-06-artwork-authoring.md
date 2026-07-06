# Artwork Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users compose their own declarative Core scenes (sky + ground + placed sprites, with ambient motion) that rotate alongside the built-ins, and use a custom sprite as the mascot.

**Architecture:** A pure `resolveCustomScene` sanitizes user scene defs (fail-soft). A canvas `drawCustomScene` composes them. `CoreScene` merges resolved custom scenes into the name-keyed `SCENE_REGISTRY` (from sub-project B) so they inherit rotation/busy/nap. `VaultfetchPanel` swaps its logo to a `use:'mascot'` sprite. A Scene Studio in Settings authors it all.

**Tech Stack:** TypeScript, React, Electron, Vitest. Renderer `src/renderer/src`, shared `src/shared`, main `src/main`, tests `tests/`.

## Global Constraints

- Branch: `artwork-authoring` — stay on it, do NOT merge (merges to `main` when the sub-project is done and reviewed).
- No `Co-Authored-By` trailer on any commit.
- No-config parity byte-identical: with no `ui.customScenes` the merged registry equals the built-in `SCENE_REGISTRY` exactly; with no `use:'mascot'` sprite the vaultfetch logo is the themed panda. Locked by resolver test (`resolveCustomScenes([]) === []`) + manual check.
- Fail-soft at the user-JSON boundary: bad sky/ground colors, out-of-range x/y/scale, unknown/renamed sprite names, reserved (built-in) or duplicate scene names all degrade, never crash.
- Clamps: prop `x`,`y` `[0,100]`; `scale` `[1,4]`. Scene `name` may not collide with a built-in name (`SCENE_NAMES`). Mascot sprite is exclusive (one at a time), like `totem`.
- Every config write spreads the current slice (`{ ...snap.ui, customScenes: … }` via `updateConfig({ ui: { customScenes } })`; sprite saves via existing `saveSprite`).
- Gates: `npm test`, `npm run typecheck`, `npm run build`. Only `resolveCustomScene` is unit-tested; canvas/registry/mascot/Studio are typecheck+build+manual, reported as manually-verifiable-only.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/shared/types.ts` | `CustomSprite.use += 'mascot'`; `SceneProp`, `CustomScene`; `UiConfig.customScenes?`. |
| `src/renderer/src/lib/resolveCustomScene.ts` | **New, pure.** sanitize/fail-soft scene defs. Unit-tested. |
| `src/renderer/src/lib/drawCustomScene.ts` | **New.** canvas composer (sky/ground/props + drift). |
| `src/renderer/src/components/CoreScene.tsx` | merge custom scenes into the registry; resolve names against the merged set; new props. |
| `src/renderer/src/hud/App.tsx` | pass `customScenes` + `sprites` to `<CoreScene>`. |
| `src/renderer/src/components/VaultfetchPanel.tsx` | draw the `mascot` sprite when set. |
| `src/main/sprites.ts` | allow + exclusive `'mascot'`. |
| `src/renderer/src/components/settings/SpritesTab.tsx` | `mascot` save target. |
| `src/renderer/src/components/settings/ScenesTab.tsx` | Scene Studio; custom names in rotation/busy/nap. |
| `tests/resolveCustomScene.test.ts` | **New.** |

---

## Task 1: Types + `resolveCustomScene` pure resolver

Additive — new file + type fields. Tree stays green.

**Files:**
- Create: `src/renderer/src/lib/resolveCustomScene.ts`
- Modify: `src/shared/types.ts` (`CustomSprite.use`, add `SceneProp`/`CustomScene`, `UiConfig.customScenes?`)
- Test: `tests/resolveCustomScene.test.ts`

**Interfaces:**
- Produces: `SceneProp { sprite:string; x:number; y:number; scale:number; drift?:boolean }`; `CustomScene { name:string; sky:[string,string]; ground:string; props:SceneProp[] }`; `resolveCustomScene(scene:unknown, validSpriteNames:Set<string>, reserved:Set<string>): CustomScene | null`; `resolveCustomScenes(list:unknown, validSpriteNames:Set<string>, reserved:Set<string>): CustomScene[]`.

- [ ] **Step 1: Extend shared types**

In `src/shared/types.ts`, change `CustomSprite.use` (line ~129) from `'frame' | 'totem' | 'none'` to:

```ts
  use: 'frame' | 'totem' | 'mascot' | 'none'
```

Add (near `SceneConfig`):

```ts
export interface SceneProp {
  sprite: string // a CustomSprite name from the library
  x: number // 0–100, % of scene width (sprite center)
  y: number // 0–100, % of scene height (sprite center)
  scale: number // 1–4 pixel scale
  drift?: boolean // slow horizontal sway + bob
}
export interface CustomScene {
  name: string // unique; may not collide with a built-in scene name
  sky: [string, string] // [top, bottom] gradient hex
  ground: string // ground band hex
  props: SceneProp[]
}
```

Add to `UiConfig` (after `scenes?`):

```ts
  customScenes?: CustomScene[]
```

- [ ] **Step 2: Write the failing test**

Create `tests/resolveCustomScene.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveCustomScene, resolveCustomScenes } from '../src/renderer/src/lib/resolveCustomScene'

const sprites = new Set(['cat', 'tree'])
const reserved = new Set(['meadow', 'night'])
const ok = { name: 'yard', sky: ['#223', '#001'], ground: '#0a0', props: [{ sprite: 'cat', x: 50, y: 60, scale: 2, drift: true }] }

describe('resolveCustomScene', () => {
  it('passes a valid scene through', () => {
    expect(resolveCustomScene(ok, sprites, reserved)).toEqual(ok)
  })
  it('drops a prop whose sprite is not in the library', () => {
    const r = resolveCustomScene({ ...ok, props: [{ sprite: 'ghost', x: 1, y: 1, scale: 1 }, ok.props[0]] }, sprites, reserved)
    expect(r?.props).toHaveLength(1)
    expect(r?.props[0].sprite).toBe('cat')
  })
  it('clamps x/y to [0,100] and scale to [1,4], coerces drift', () => {
    const r = resolveCustomScene({ ...ok, props: [{ sprite: 'cat', x: -20, y: 300, scale: 9, drift: 1 }] }, sprites, reserved)
    expect(r?.props[0]).toEqual({ sprite: 'cat', x: 0, y: 100, scale: 4, drift: true })
  })
  it('falls back on bad sky/ground', () => {
    const r = resolveCustomScene({ name: 'x', sky: 'nope', ground: 5, props: [] }, sprites, reserved)
    expect(r?.sky).toEqual(['#12131a', '#05060a'])
    expect(r?.ground).toBe('#0e1013')
  })
  it('rejects empty / non-string / reserved names → null', () => {
    expect(resolveCustomScene({ ...ok, name: '' }, sprites, reserved)).toBeNull()
    expect(resolveCustomScene({ ...ok, name: 5 }, sprites, reserved)).toBeNull()
    expect(resolveCustomScene({ ...ok, name: 'meadow' }, sprites, reserved)).toBeNull()
  })
  it('never throws on garbage', () => {
    expect(resolveCustomScene(null, sprites, reserved)).toBeNull()
    expect(resolveCustomScene(42, sprites, reserved)).toBeNull()
  })
})

describe('resolveCustomScenes', () => {
  it('empty / non-array → [] (parity: merged registry == built-ins)', () => {
    expect(resolveCustomScenes(undefined, sprites, reserved)).toEqual([])
    expect(resolveCustomScenes('x', sprites, reserved)).toEqual([])
  })
  it('drops duplicates by name (first wins)', () => {
    const r = resolveCustomScenes([ok, { ...ok, ground: '#fff' }], sprites, reserved)
    expect(r).toHaveLength(1)
    expect(r[0].ground).toBe('#0a0')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/resolveCustomScene.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/renderer/src/lib/resolveCustomScene.ts`:

```ts
import type { CustomScene, SceneProp } from '@shared/types'

const SKY_DEFAULT: [string, string] = ['#12131a', '#05060a']
const GROUND_DEFAULT = '#0e1013'

const hex = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : fallback
const clamp = (v: unknown, min: number, max: number, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def

function cleanProp(p: unknown, validSpriteNames: Set<string>): SceneProp | null {
  if (typeof p !== 'object' || p === null) return null
  const o = p as Record<string, unknown>
  if (typeof o.sprite !== 'string' || !validSpriteNames.has(o.sprite)) return null
  return {
    sprite: o.sprite,
    x: clamp(o.x, 0, 100, 50),
    y: clamp(o.y, 0, 100, 50),
    scale: clamp(o.scale, 1, 4, 2),
    drift: !!o.drift
  }
}

// sanitize one user scene; null if unusable (bad/empty/reserved name).
export function resolveCustomScene(
  scene: unknown,
  validSpriteNames: Set<string>,
  reserved: Set<string>
): CustomScene | null {
  if (typeof scene !== 'object' || scene === null) return null
  const o = scene as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (!name || reserved.has(name)) return null
  const skyArr = Array.isArray(o.sky) ? o.sky : []
  const sky: [string, string] = [hex(skyArr[0], SKY_DEFAULT[0]), hex(skyArr[1], SKY_DEFAULT[1])]
  const props = (Array.isArray(o.props) ? o.props : [])
    .map((p) => cleanProp(p, validSpriteNames))
    .filter((p): p is SceneProp => p !== null)
  return { name, sky, ground: hex(o.ground, GROUND_DEFAULT), props }
}

// sanitize the list; drops nulls and later duplicates of a name.
export function resolveCustomScenes(
  list: unknown,
  validSpriteNames: Set<string>,
  reserved: Set<string>
): CustomScene[] {
  const seen = new Set<string>()
  const out: CustomScene[] = []
  for (const s of Array.isArray(list) ? list : []) {
    const c = resolveCustomScene(s, validSpriteNames, reserved)
    if (c && !seen.has(c.name)) {
      seen.add(c.name)
      out.push(c)
    }
  }
  return out
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/resolveCustomScene.test.ts && npm run typecheck`
Expected: all pass; typecheck clean (union widening + new optional fields are additive).

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/renderer/src/lib/resolveCustomScene.ts tests/resolveCustomScene.test.ts
git commit -m "feat: CustomScene types + resolveCustomScene pure resolver"
```

---

## Task 2: Custom mascot

**Files:**
- Modify: `src/renderer/src/components/VaultfetchPanel.tsx`, `src/main/sprites.ts`, `src/renderer/src/components/settings/SpritesTab.tsx`

**Interfaces:**
- Consumes: `CustomSprite.use === 'mascot'` (Task 1).

- [ ] **Step 1: sprites.ts — allow + exclusive mascot**

In `src/main/sprites.ts`, change the `sane()` use check (line ~16) from `['frame', 'totem', 'none'].includes(s.use)` to:

```ts
    ['frame', 'totem', 'mascot', 'none'].includes(s.use)
```

And make mascot exclusive like totem — after the existing totem block (line ~43-45), add:

```ts
  if (sprite.use === 'mascot') {
    for (const s of next) if (s.name !== sprite.name && s.use === 'mascot') s.use = 'none'
  }
```

- [ ] **Step 2: VaultfetchPanel — draw the mascot sprite when set**

In `src/renderer/src/components/VaultfetchPanel.tsx`, the logo `useEffect` draws `PANDA_MINI` with `pandaColor`. Add a mascot-sprite lookup and, when present, draw that grid instead. Before the effect, add:

```ts
  const mascotSprite = snap.sprites.find((s) => s.use === 'mascot')
```

Replace the draw effect body so it prefers the custom sprite. The effect becomes:

```ts
  useEffect(() => {
    const cv = logoRef.current
    if (!cv || !opts.showLogo) return
    const grid = mascotSprite?.grid
    const w = grid ? (grid[0]?.length ?? 0) : PANDA_MINI[0].length
    const h = grid ? grid.length : PANDA_MINI.length
    if (w === 0 || h === 0) return
    const scale = 4
    const dpr = window.devicePixelRatio || 1
    cv.width = w * scale * dpr
    cv.height = h * scale * dpr
    cv.style.width = `${w * scale}px`
    cv.style.height = `${h * scale}px`
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w * scale, h * scale)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const col = grid ? grid[y][x] : pandaColor(PANDA_MINI[y][x] ?? '.', mascotPal, false)
        if (col) {
          ctx.fillStyle = col
          ctx.fillRect(x * scale, y * scale, scale, scale)
        }
      }
    }
  }, [opts.showLogo, mascotSprite, mascotPal.body, mascotPal.dark, mascotPal.ink, mascotPal.eye, mascotPal.muzzle])
```

- [ ] **Step 3: SpritesTab — mascot save target**

In `src/renderer/src/components/settings/SpritesTab.tsx`, both `(['totem', 'frame', 'none'] as const)` maps (lines ~71 and ~92) become:

```ts
              {(['totem', 'frame', 'mascot', 'none'] as const).map((use) => (
```

and in the draft save-button label (line ~80), extend the ternary so mascot reads clearly:

```ts
                  save → {use === 'none' ? 'library only' : use === 'totem' ? 'totem panel' : use === 'mascot' ? 'the mascot' : 'frame patrol'}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass / clean / exit 0.

- [ ] **Step 5: Manual smoke (DOM)**

In `npm run dev`: with no mascot sprite the vaultfetch logo is the themed panda (unchanged). In Settings → Sprites, save a sprite as **the mascot** → the vaultfetch logo becomes that sprite; saving another as mascot clears the first. Report observations.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: custom mascot — a use:'mascot' sprite replaces the vaultfetch logo"
```

---

## Task 3: Custom-scene renderer + registry merge

**Files:**
- Create: `src/renderer/src/lib/drawCustomScene.ts`
- Modify: `src/renderer/src/components/CoreScene.tsx`, `src/renderer/src/hud/App.tsx`

**Interfaces:**
- Consumes: `resolveCustomScenes` (Task 1), `SCENE_NAMES` (exported from CoreScene).
- Produces: `drawCustomScene(ctx, scene, spritesByName, f, W, H)`; `CoreScene` props `customScenes?: CustomScene[]`, `sprites: CustomSprite[]`.

- [ ] **Step 1: Implement the canvas composer**

Create `src/renderer/src/lib/drawCustomScene.ts`:

```ts
import type { CustomScene } from '@shared/types'

// Compose a declarative scene: sky gradient, ground band, then each placed
// sprite (with optional ambient drift/bob). Pure drawing — no state. A prop
// whose sprite is missing from the map is skipped.
export function drawCustomScene(
  ctx: CanvasRenderingContext2D,
  scene: CustomScene,
  spritesByName: Map<string, string[][]>,
  f: number,
  W: number,
  H: number
): void {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, scene.sky[0])
  g.addColorStop(1, scene.sky[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const horizon = Math.round(H * 0.78)
  ctx.fillStyle = scene.ground
  ctx.fillRect(0, horizon, W, H - horizon)

  for (const p of scene.props) {
    const grid = spritesByName.get(p.sprite)
    if (!grid || grid.length === 0 || !grid[0]) continue
    const gw = grid[0].length
    const gh = grid.length
    const drift = p.drift ? Math.sin(f / 90) * 6 : 0
    const bob = p.drift ? Math.round(Math.sin(f / 30)) : 0
    const ox = Math.round((p.x / 100) * W + drift - (gw * p.scale) / 2)
    const oy = Math.round((p.y / 100) * H + bob - (gh * p.scale) / 2)
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const col = grid[y][x]
        if (col) {
          ctx.fillStyle = col
          ctx.fillRect(ox + x * p.scale, oy + y * p.scale, p.scale, p.scale)
        }
      }
    }
  }
}
```

- [ ] **Step 2: CoreScene — accept props, merge the registry, resolve against merged names**

In `src/renderer/src/components/CoreScene.tsx`:

Add imports:

```ts
import { resolveCustomScenes } from '../lib/resolveCustomScene'
import { drawCustomScene } from '../lib/drawCustomScene'
import type { CustomScene, CustomSprite } from '@shared/types'
```

Add `useMemo` to the existing `react` import if not present.

Extend the `CoreScene` props interface/params with (alongside `scenes`):

```ts
  customScenes?: CustomScene[]
  sprites: CustomSprite[]
```

Right before `const scn = resolveScenes(scenes, SCENE_NAMES, ROTATION_DEFAULT, FPS)`, build the merged registry and use its keys:

```ts
  const spritesByName = useMemo(() => new Map((sprites ?? []).map((s) => [s.name, s.grid])), [sprites])
  const customList = useMemo(
    () => resolveCustomScenes(customScenes, new Set(spritesByName.keys()), new Set(SCENE_NAMES)),
    [customScenes, spritesByName]
  )
  const registry = useMemo(
    () => ({
      ...SCENE_REGISTRY,
      ...Object.fromEntries(
        customList.map((s) => [
          s.name,
          { name: s.name, horizon: Math.round(H * 0.78), draw: (c: Ctx, f: number) => drawCustomScene(c, s, spritesByName, f, W, H) }
        ])
      )
    }),
    [customList, spritesByName]
  )
  const registryRef = useRef(registry)
  registryRef.current = registry
  const scn = resolveScenes(scenes, Object.keys(registry), ROTATION_DEFAULT, FPS)
```

Then replace the four `SCENE_REGISTRY[…]` lookups **inside the render loop** with `registryRef.current[…]`:

- `const entry = busyRef.current ? SCENE_REGISTRY[scnRef.current.busy] : SCENE_REGISTRY[rot[slot % rot.length]]`
  → `const entry = busyRef.current ? registryRef.current[scnRef.current.busy] : registryRef.current[rot[slot % rot.length]]`
- `const prevEntry = SCENE_REGISTRY[rot[(slot - 1) % rot.length]]`
  → `const prevEntry = registryRef.current[rot[(slot - 1) % rot.length]]`
- `SCENE_REGISTRY[scnRef.current.nap].draw(sctx, frame, false)`
  → `registryRef.current[scnRef.current.nap].draw(sctx, frame, false)`

(The module-const `SCENE_REGISTRY` and `SCENE_NAMES` definitions stay — they're the built-in base the merge spreads and the reserved-name set.)

- [ ] **Step 3: App — pass the new props to the Core module**

In `src/renderer/src/hud/App.tsx`, the `core` module's `render` renders `<CoreScene … scenes={s.ui.scenes} maxWidth={ctx.coreMax} />`. Add the two props:

```tsx
          <CoreScene
            usagePercent={s.usage.percent}
            busy={s.commands.some((c) => c.status.state === 'running')}
            mood={s.mood}
            loot={s.loot}
            graph={s.graph}
            chart={ctx.chart}
            scenes={s.ui.scenes}
            customScenes={s.ui.customScenes}
            sprites={s.sprites}
            maxWidth={ctx.coreMax}
          />
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass / clean / exit 0.

- [ ] **Step 5: Manual smoke (DOM)**

In `npm run dev`: with no custom scenes, the Core rotates exactly as before (parity). Hand-add to `~/.vault-hud/config.json` a `ui.customScenes: [{ "name":"mine", "sky":["#204","#003"], "ground":"#20033a", "props":[{"sprite":"<a real sprite name>","x":50,"y":70,"scale":3,"drift":true}] }]` and add `"mine"` to `ui.scenes.rotation`, restart → the custom scene appears in rotation with the sprite drifting. Report observations.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: custom scenes merge into the Core scene registry + rotate"
```

---

## Task 4: Scene Studio (Settings)

**Files:**
- Modify: `src/renderer/src/components/settings/ScenesTab.tsx`

**Interfaces:**
- Consumes: `resolveCustomScenes`, `drawCustomScene` (Tasks 1/3); `SCENE_NAMES` (CoreScene); primitives.

- [ ] **Step 1: Imports + custom names in rotation/busy/nap**

In `src/renderer/src/components/settings/ScenesTab.tsx`, add imports:

```ts
import { useRef, useState } from 'react'
import type { CustomScene, SceneProp } from '@shared/types'
import { SCENE_NAMES } from '../CoreScene'
import { drawCustomScene } from '../../lib/drawCustomScene'
import { Section, Picker } from './primitives'
```

(Keep the existing imports; merge these in — `Section`, `Picker`, `Row`, `Stepper`, `Chips`, `Toggle` as needed. `SCENE_NAMES` may already be imported for the busy/nap pickers — don't double-import.)

Compute the full scene-name list once (built-ins ⊕ custom) and use it for the rotation `Chips`, busy `Picker`, and nap `Picker` in place of `ROTATION_DEFAULT` / `SCENE_NAMES`:

```ts
  const customScenes = snap.ui.customScenes ?? []
  const allSceneNames = [...SCENE_NAMES, ...customScenes.map((s) => s.name)]
  const rotatable = [...ROTATION_DEFAULT, ...customScenes.map((s) => s.name)]
```

- the rotation `Chips` `items` → `rotatable`
- the busy `Picker` `options` → `allSceneNames`
- the nap `Picker` `options` → `allSceneNames`

- [ ] **Step 2: Scene Studio state + handlers**

Inside `ScenesTab`, add the draft + preview:

```ts
  const [draft, setDraft] = useState<CustomScene | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const spriteNames = snap.sprites.map((s) => s.name)

  const newScene = (): void =>
    setDraft({ name: '', sky: ['#1a2340', '#05060f'], ground: '#0e1013', props: [] })
  const patchDraft = (p: Partial<CustomScene>): void => setDraft((d) => (d ? { ...d, ...p } : d))
  const addProp = (): void => {
    if (!draft || spriteNames.length === 0) return
    patchDraft({ props: [...draft.props, { sprite: spriteNames[0], x: 50, y: 65, scale: 2, drift: true }] })
  }
  const patchProp = (i: number, p: Partial<SceneProp>): void => {
    if (!draft) return
    patchDraft({ props: draft.props.map((pr, j) => (j === i ? { ...pr, ...p } : pr)) })
  }
  const removeProp = (i: number): void => draft && patchDraft({ props: draft.props.filter((_, j) => j !== i) })
  const saveScene = (): void => {
    if (!draft || !draft.name.trim() || SCENE_NAMES.includes(draft.name.trim())) return
    const name = draft.name.trim()
    const next = [...customScenes.filter((s) => s.name !== name), { ...draft, name }]
    window.vault.updateConfig({ ui: { customScenes: next } })
    setDraft(null)
  }
  const removeScene = (name: string): void =>
    window.vault.updateConfig({ ui: { customScenes: customScenes.filter((s) => s.name !== name) } })

  // live preview: redraw whenever the draft changes
  const drawPreview = (cv: HTMLCanvasElement | null): void => {
    if (!cv || !draft) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const map = new Map(snap.sprites.map((s) => [s.name, s.grid]))
    drawCustomScene(ctx, draft, map, 0, cv.width, cv.height)
  }
```

- [ ] **Step 3: Scene Studio markup**

Add a `SCENE STUDIO` section after the existing rotation section (inside the returned fragment). Uses native color inputs for sky/ground and steppers for props:

```tsx
      <Section title="SCENE STUDIO">
        {customScenes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {customScenes.map((s) => (
              <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, border: '1px solid var(--line-soft)', borderRadius: 4, padding: '2px 6px' }}>
                {s.name}
                <span onClick={() => removeScene(s.name)} style={{ cursor: 'pointer', color: 'var(--danger)' }}>✕</span>
              </span>
            ))}
          </div>
        )}
        {!draft && (
          <button onClick={newScene} style={{ fontSize: 10 }} disabled={spriteNames.length === 0}>
            {spriteNames.length === 0 ? '+ new scene (make a sprite first)' : '+ new scene'}
          </button>
        )}
        {draft && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--line-soft)', padding: 10 }}>
            <canvas ref={(el) => { previewRef.current = el; drawPreview(el) }} width={220} height={132} style={{ width: 220, height: 132, imageRendering: 'pixelated', border: '1px solid var(--line-soft)', alignSelf: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 10 }}>
              <span className="dim">name</span>
              <input value={draft.name} maxLength={16} onChange={(e) => patchDraft({ name: e.target.value })}
                style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 6px', width: 110 }} />
              <span className="dim">sky</span>
              <input type="color" value={draft.sky[0]} onChange={(e) => patchDraft({ sky: [e.target.value, draft.sky[1]] })} />
              <input type="color" value={draft.sky[1]} onChange={(e) => patchDraft({ sky: [draft.sky[0], e.target.value] })} />
              <span className="dim">ground</span>
              <input type="color" value={draft.ground} onChange={(e) => patchDraft({ ground: e.target.value })} />
            </div>
            {draft.props.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                <Picker value={p.sprite} options={spriteNames} onPick={(sprite) => patchProp(i, { sprite })} />
                <span className="dim">x</span><button onClick={() => patchProp(i, { x: Math.max(0, p.x - 5) })}>−</button><span className="dim" style={{ minWidth: 26, textAlign: 'center' }}>{p.x}</span><button onClick={() => patchProp(i, { x: Math.min(100, p.x + 5) })}>+</button>
                <span className="dim">y</span><button onClick={() => patchProp(i, { y: Math.max(0, p.y - 5) })}>−</button><span className="dim" style={{ minWidth: 26, textAlign: 'center' }}>{p.y}</span><button onClick={() => patchProp(i, { y: Math.min(100, p.y + 5) })}>+</button>
                <span className="dim">×</span><button onClick={() => patchProp(i, { scale: Math.max(1, p.scale - 1) })}>−</button><span className="dim">{p.scale}</span><button onClick={() => patchProp(i, { scale: Math.min(4, p.scale + 1) })}>+</button>
                <button onClick={() => patchProp(i, { drift: !p.drift })} style={{ color: p.drift ? 'var(--clay)' : 'var(--ink)' }}>{p.drift ? '● drift' : '○ drift'}</button>
                <span onClick={() => removeProp(i)} style={{ cursor: 'pointer', color: 'var(--danger)' }}>✕</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addProp} style={{ fontSize: 10 }} disabled={spriteNames.length === 0}>+ sprite</button>
              <button onClick={saveScene} style={{ fontSize: 10 }} disabled={!draft.name.trim() || SCENE_NAMES.includes(draft.name.trim())}>save scene</button>
              <button onClick={() => setDraft(null)} style={{ fontSize: 10 }}>cancel</button>
            </div>
            <div className="dim" style={{ fontSize: 9 }}>preview is a still; drift animates in the Core. save, then check the scene into rotation above.</div>
          </div>
        )}
      </Section>
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass / clean / exit 0.

- [ ] **Step 5: Manual smoke (DOM)**

In `npm run dev`, Scenes tab: with no sprites, "+ new scene" is disabled with the hint. Make a sprite, then compose a scene — the preview updates as you change sky/ground/props; save it; it appears in the rotation checklist; check it in and confirm it rotates into the Core. Remove a custom scene from the list. Export the rice (Share) and confirm `customScenes` travels. Report observations.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/settings/ScenesTab.tsx
git commit -m "feat: Scene Studio — author custom scenes with a live preview"
```

---

## Self-Review

- **Spec coverage:** types incl. `use:'mascot'` + `CustomScene`/`SceneProp`/`customScenes` (T1) ✓; resolver fail-soft/clamp/reserved/dup (T1) ✓; canvas composer with drift (T3 §1) ✓; registry merge + name resolution against merged set + parity (T3 §2) ✓; custom mascot in vaultfetch + exclusive + save target (T2) ✓; Scene Studio pickers/steppers/preview/save/list + custom names in rotation/busy/nap (T4) ✓; rides the rice (customScenes on ui, sprites in library — no extra work) ✓; every write spreads slice (T4) ✓.
- **Placeholders:** none — complete code each step; manual smokes flagged un-automatable.
- **Type consistency:** `resolveCustomScene(scene, validSpriteNames, reserved)`, `resolveCustomScenes(list, …)`, `CustomScene{name,sky,ground,props}`, `SceneProp{sprite,x,y,scale,drift?}`, `drawCustomScene(ctx,scene,spritesByName,f,W,H)`, CoreScene props `customScenes?`/`sprites` — consistent T1→T4. `SCENE_NAMES` (exported from CoreScene) used as the reserved set and for Settings names.
- **Ordering:** T1 additive/green; T2 mascot, T3 renderer+registry (+App prop wiring), T4 Studio — each green + testable at its end.
