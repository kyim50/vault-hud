# Core Scene: Mascot Simplification + Camera-Pan Transition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring back the beloved simple "blob" mascot (with pointy ears so it isn't Claude's mascot) and replace the orbiting-particle scene transition with a natural camera pan plus a traveler walker.

**Architecture:** Two independent, Core-scene-only changes. (1) The mascot is a pure pixel swap in `panda.ts` — same sprite dimensions, so every scene call site is untouched. (2) The transition gets a new pure geometry module `pan.ts` (unit-tested) plus a `drawPan` renderer in `CoreScene.tsx` that slides the outgoing and incoming scene buffers past each other while a walker strides across the foreground.

**Tech Stack:** TypeScript, React, Electron (electron-vite), HTML canvas 2D, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-04-core-scene-mascot-and-pan-transition-design.md`

## Global Constraints

- Pixel-art purity: the Core canvas must never anti-alias. Integer pixel offsets only; no `fillText`; no fractional `drawImage` positions. (Verbatim from spec / project memory.)
- Sprite dimensions are fixed so scene call sites don't move: `PANDA` 26×14 with 12 body rows (`PANDA_W=26`, `PANDA_BODY_ROWS=12`); `PANDA_BUDDY` 12 wide (`PANDA_BUDDY_W=12`); `PANDA_MINI` 14 wide (`PANDA_MINI_W=14`).
- Canvas size: `W = 192`, `H = 108`. Ink color `INK = '#e8e6e3'`.
- Tests live in `tests/*.test.ts`, run with `npm test` (vitest). Typecheck with `npm run typecheck`.
- Commit after each task.

---

### Task 1: Simplify the mascot sprites to the pointy-eared blob

**Files:**
- Modify: `src/renderer/src/lib/panda.ts` (top doc-comment + `PANDA`, `PANDA_BUDDY`, `PANDA_MINI` matrices)
- Modify: `tests/panda.test.ts:29-33` (the ringed-tail test — the new mascot has no tail)

**Interfaces:**
- Consumes: nothing new.
- Produces: same exported names/types as today (`PANDA`, `PANDA_W`, `PANDA_BODY_ROWS`, `PANDA_BUDDY`, `PANDA_BUDDY_W`, `PANDA_MINI`, `PANDA_MINI_W`, `pandaColor`, `DEFAULT_PALETTE`). Only pixel contents change; no signature changes.

- [ ] **Step 1: Replace the failing "ringed tail" test with a "simplified, no tail/muzzle" test**

In `tests/panda.test.ts`, replace the `it('has an ink/clay ringed tail ...')` block (lines 29-33) with:

```ts
  it('is a simplified blob — no tail rings, muzzle mask, or nose', () => {
    const flat = rows.join('')
    expect(flat).not.toContain('I') // no ringed tail
    expect(flat).not.toContain('M') // no cream muzzle mask
    expect(flat).not.toContain('o') // no nose
  })
```

Leave the other blocks (`has uniform row widths`, `has triangular ears on top`, `uses only known palette chars`, `PANDA legs`, `pandaColor`) unchanged.

- [ ] **Step 2: Run the test to verify it fails against the current red-panda matrices**

Run: `npm test -- panda`
Expected: FAIL — the current `PANDA`/`PANDA_BUDDY`/`PANDA_MINI` still contain `I`, `M`, and `o`, so `not.toContain` assertions fail.

- [ ] **Step 3: Replace the three matrices and the doc-comment in `panda.ts`**

Replace the top comment block (lines 1-10) with:

```ts
// The mascot: a simple clay "blob" sprite with pointy ears — deliberately
// minimal (solid body, two dot-eyes) so it reads as its own small creature,
// not Anthropic's mascot. Shared by the Core scenes, the HUD frame critters,
// and the notch island.
//
// Char language: B body(clay) · D dark clay edge / ears · n ear · E eye
// (blinks) · L stubby leg · . transparent
```

Replace `PANDA` with:

```ts
export const PANDA = [
  '.....n..............n.....',
  '....nnn............nnn....',
  '...BBBBBBBBBBBBBBBBBBBB...',
  '..BBBBBBBBBBBBBBBBBBBBDD..',
  '..BBBEEBBBBBBBBBBEEBBBDD..',
  '..BBBEEBBBBBBBBBBEEBBBDD..',
  '..BBBBBBBBBBBBBBBBBBBBDD..',
  '..BBBBBBBBBBBBBBBBBBBBDD..',
  '..BBBBBBBBBBBBBBBBBBBBDD..',
  '...BBBBBBBBBBBBBBBBBBDD...',
  '...BBBBBBBBBBBBBBBBBBDD...',
  '....BBBBBBBBBBBBBBBBDD....',
  '.....LL..LL....LL..LL.....',
  '.....LL..LL....LL..LL.....'
]
```

Replace `PANDA_BUDDY` with:

```ts
export const PANDA_BUDDY = [
  '..n......n..',
  '.nnn....nnn.',
  '.BBBBBBBBBB.',
  'BBEBBBBBEBBB',
  '.BBBBBBBBBB.',
  '.L.LL..LL.L.'
]
```

Replace `PANDA_MINI` with:

```ts
export const PANDA_MINI = [
  '...n......n...',
  '..nnn....nnn..',
  '..BBBBBBBBBB..',
  '.BBBBBBBBBBBB.',
  '.BBEEBBBBEEBB.',
  '.BBEEBBBBEEBB.',
  '.BBBBBBBBBBBB.',
  '..BBBBBBBBBB..',
  '..L.LL..LL.L..'
]
```

Leave `PANDA_W = 26`, `PANDA_BODY_ROWS = 12`, `PANDA_BUDDY_W = 12`, `PANDA_MINI_W = 14`, `pandaColor`, and `DEFAULT_PALETTE` unchanged. (`pandaColor` still handles `I`/`M`/`o` as harmless dead branches; the `pandaColor('I', …)` unit test keeps passing.)

- [ ] **Step 4: Run the mascot tests and verify they pass**

Run: `npm test -- panda`
Expected: PASS — widths uniform (26/12/14), triangular ears (row0 tip count ≤ row1 base count, both > 0), no `I`/`M`/`o`, only known chars, 4 leg groups on `PANDA` with the last two rows equal.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/panda.ts tests/panda.test.ts
git commit -m "feat: simplify mascot to the pointy-eared clay blob"
```

---

### Task 2: `pan.ts` pure geometry module

**Files:**
- Create: `src/renderer/src/lib/pan.ts`
- Create: `tests/pan.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `easeOutCubic(t: number): number`
  - `interface PanFrame { dx: number; seamX: number; travelerX: number; showTraveler: boolean }`
  - `panGeom(t: number, width: number): PanFrame`

- [ ] **Step 1: Write the failing test**

Create `tests/pan.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { panGeom, easeOutCubic } from '../src/renderer/src/lib/pan'

const W = 192

describe('easeOutCubic', () => {
  it('pins the endpoints', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })
})

describe('panGeom', () => {
  it('starts flush and ends fully panned', () => {
    expect(panGeom(0, W).dx).toBe(0)
    expect(panGeom(1, W).dx).toBe(W)
  })

  it('dx is monotonic non-decreasing across the pan', () => {
    let prev = -1
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const { dx } = panGeom(t, W)
      expect(dx).toBeGreaterThanOrEqual(prev)
      prev = dx
    }
  })

  it('keeps the seam within [0, W]', () => {
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const { seamX } = panGeom(t, W)
      expect(seamX).toBeGreaterThanOrEqual(0)
      expect(seamX).toBeLessThanOrEqual(W)
    }
  })

  it('hides the traveler past 0.8 so it never doubles the incoming panda', () => {
    expect(panGeom(0.5, W).showTraveler).toBe(true)
    expect(panGeom(0.85, W).showTraveler).toBe(false)
  })

  it('clamps t outside [0,1]', () => {
    expect(panGeom(-0.5, W).dx).toBe(0)
    expect(panGeom(1.5, W).dx).toBe(W)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- pan`
Expected: FAIL — `Cannot find module '../src/renderer/src/lib/pan'`.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/src/lib/pan.ts`:

```ts
// Camera-pan transition geometry — pure, so it can be unit-tested away from
// the canvas. `panGeom` maps transition progress t∈[0,1] to how far the two
// scene buffers have slid, where the seam sits, and where the traveler walks.

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export interface PanFrame {
  dx: number // how far (px) both worlds have slid left
  seamX: number // x of the boundary between outgoing and incoming
  travelerX: number // walker x — gentle rightward drift across center-bottom
  showTraveler: boolean // stop the walker before the incoming panda fully lands
}

export function panGeom(t: number, width: number): PanFrame {
  const clamped = Math.max(0, Math.min(1, t))
  const e = easeOutCubic(clamped)
  const dx = Math.round(e * width)
  return {
    dx,
    seamX: width - dx,
    travelerX: Math.round(width / 2 - 12 + e * 24),
    showTraveler: clamped < 0.8
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- pan`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/pan.ts tests/pan.test.ts
git commit -m "feat: add pan.ts camera-pan transition geometry"
```

---

### Task 3: Wire `drawPan` into CoreScene and delete the orbit transition

**Files:**
- Modify: `src/renderer/src/components/CoreScene.tsx`

**Interfaces:**
- Consumes: `panGeom` from `src/renderer/src/lib/pan.ts` (Task 2); existing module-scope `SCENES`, `drawWalker`, `W`, `H`, `INK`, `SCENE_FRAMES`.
- Produces: `drawPan(...)` (module-scope helper) and two offscreen buffers in the render effect. No exported API changes.

> This task is canvas rendering — there is no unit test. It is verified by typecheck, a production build, and a manual `npm run dev` observation. Do all edits, then run the verification steps, then commit.

- [ ] **Step 1: Import `panGeom`**

At the top of `CoreScene.tsx`, add to the imports:

```ts
import { panGeom } from '../lib/pan'
```

- [ ] **Step 2: Add the `PAN_GROUND` constant and `drawPan` helper; delete the orbit code**

Delete these now-dead definitions entirely:
- the `Particle` interface (`interface Particle { … }`)
- `samplePixels(...)`
- `buildParticles(...)`
- `const ease = (t) => 1 - Math.pow(1 - t, 3)` (only the orbit used it)
- `drawTransition(...)`

Keep `TRANS_FRAMES` (still the transition length) and `hash` (used elsewhere).

In their place add:

```ts
// ground line the traveler walks along during a scene pan
const PAN_GROUND = 92

// Camera-pan transition: slide the outgoing scene off left while the incoming
// scene slides in from the right, with a walker striding across the foreground.
function drawPan(
  ctx: Ctx,
  fromBuf: HTMLCanvasElement,
  toBuf: HTMLCanvasElement,
  fromCtx: Ctx,
  toCtx: Ctx,
  fromScene: number,
  toScene: number,
  frozenF: number,
  liveF: number,
  blink: boolean,
  t: number
): void {
  // outgoing world is frozen so it doesn't keep animating as it leaves;
  // incoming world animates live
  fromCtx.clearRect(0, 0, W, H)
  SCENES[fromScene](fromCtx, frozenF, false)
  toCtx.clearRect(0, 0, W, H)
  SCENES[toScene](toCtx, liveF, blink)

  const { dx, seamX, travelerX, showTraveler } = panGeom(t, W)
  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(fromBuf, -dx, 0)
  ctx.drawImage(toBuf, W - dx, 0)

  // 1px ink seam reads as an intentional panel wipe
  ctx.fillStyle = INK
  ctx.fillRect(seamX, 0, 1, H)

  // a mascot walks across the foreground so the eye follows one panda
  if (showTraveler) drawWalker(ctx, liveF, false, travelerX, PAN_GROUND, true)
}
```

- [ ] **Step 3: Add the two pan buffers in the render effect and remove the `parts` state**

In the render effect where `sceneOff`/`sctx` are created (near the other offscreen canvases), add two more buffers:

```ts
const panFrom = document.createElement('canvas')
panFrom.width = W
panFrom.height = H
const pfctx = panFrom.getContext('2d')!
const panTo = document.createElement('canvas')
panTo.width = W
panTo.height = H
const ptctx = panTo.getContext('2d')!
```

Delete the transition bookkeeping variables that fed the orbit:

```ts
// DELETE these lines:
let parts: Particle[] | null = null
// …and the `partsSlot` variable declaration…
```

(Search the effect for `parts` and `partsSlot` and remove their declarations; they are only referenced by the code replaced in Step 4.)

- [ ] **Step 4: Replace the transition branch at the render call site**

Find the transition branch (currently guarded by `if (!napping && inScene < TRANS_FRAMES && slot > 0 && !busyRef.current)`) inside `if (dissolve < 1)`. Replace the whole `if` body (the `buildParticles`/`partsSlot`/`drawTransition` block) with:

```ts
        if (!napping && inScene < TRANS_FRAMES && slot > 0 && !busyRef.current) {
          const prev = (slot - 1) % SCENES.length
          const blinkEvery = usageRef.current > 80 ? 24 : 48
          const frozenF = slot * SCENE_FRAMES - 1 // last frame of the outgoing scene
          drawPan(
            sctx,
            panFrom,
            panTo,
            pfctx,
            ptctx,
            prev,
            sceneIdx,
            frozenF,
            frame,
            frame % blinkEvery >= blinkEvery - 6,
            inScene / TRANS_FRAMES
          )
          lastFrame = -1
        } else if (frame !== lastFrame) {
```

Leave the `else if (frame !== lastFrame)` body (the normal per-frame scene render) as-is, except remove the now-dead `parts = null` line inside it if present.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. In particular, no "unused variable" errors for `parts`, `partsSlot`, `Particle`, `ease`, `samplePixels`, `buildParticles`, or `drawTransition` — all must be gone.

- [ ] **Step 6: Production build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 7: Manual verification in the app**

Run: `npm run dev`
Observe the Core panel for one full scene rotation (~22s cadence). Confirm:
- The mascot is the simplified pointy-eared blob in every pose (walker, surf/nap sitter, disco DJ, buddy, notch mini).
- On a scene change, the old scene slides off left while the new one slides in from the right, with a crisp 1px seam and a walker striding across the foreground — no orbiting particles.
- Everything stays pixel-crisp (no blur/anti-aliasing) and the constellation hover-dissolve still works.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/CoreScene.tsx
git commit -m "feat: camera-pan scene transition with traveler walker"
```

---

## Self-Review

**Spec coverage:**
- Mascot simplify (blob + pointy ears), 26×14 dims preserved, `pandaColor` untouched, doc-comment rewritten, `BUDDY`/`MINI` same treatment → **Task 1**. ✓
- `pan.ts` `panGeom`/`easeOutCubic` with the exact `PanFrame` fields → **Task 2**. ✓
- `drawPan` + two buffers + seam + traveler + frozen outgoing / live incoming; call-site swap; deletions of `drawTransition`/`buildParticles`/`samplePixels`/`Particle`/`parts`/`partsSlot` (and `ease`, which only the orbit used) → **Task 3**. ✓
- Untouched behaviors (disco lock, napping, `slot > 0`, constellation dissolve) preserved by leaving the surrounding branches alone → **Task 3, Steps 4 & 7**. ✓
- Verification: `pan.ts` unit tests + mascot render/dev check → **Tasks 1–3 verification steps**. ✓

**Placeholder scan:** No TBD/TODO; all matrices, test bodies, and the `drawPan`/`panGeom` implementations are shown in full. ✓

**Type consistency:** `panGeom(t, width)` returns `{ dx, seamX, travelerX, showTraveler }`; Task 3 destructures exactly those names. `drawWalker(ctx, f, blink, x, groundY, moving)` matches the existing signature. `Ctx` is the existing CoreScene alias for `CanvasRenderingContext2D`. ✓
