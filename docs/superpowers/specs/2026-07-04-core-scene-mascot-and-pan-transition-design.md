# Core scene: mascot simplification + camera-pan transition

Date: 2026-07-04
Surface: `src/renderer/src/components/CoreScene.tsx` and `src/renderer/src/lib/`

Two related changes to the Core canvas, both approved via brainstorming. They are
independent and can ship separately, but share this doc because both are Core-scene
visuals.

---

## 1. Mascot: simplify back to the "blob" with pointy ears

### Problem

The current mascot (`src/renderer/src/lib/panda.ts`) is a red panda with a busy face —
a light cream muzzle-mask covering half the head, a nose dot, eye patches, and a striped
ink tail. That detail lost the charm of an earlier mascot: a simple solid-clay loaf with
two dot-eyes (the `SPRITE` const in `CoreScene.tsx` at commit `1fa6ed9`). That blob was
loved for its simplicity, but it was retired because a plain rounded clay blob with
dot-eyes reads as Anthropic's Claude mascot.

### Decision

Bring back the blob, with **one** minimal tweak that commits it to a distinct animal:
**pointy triangular ears** instead of the old corner nubs. Pointy ears alone make it read
as its own creature (not Claude's rounded/sprout silhouette) while keeping the loaf 99%
intact. No tail, no muzzle-mask, no nose.

### Locked sprite (`PANDA`, 26×14, body rows 12 — unchanged dims)

```
'.....n..............n.....'
'....nnn............nnn....'
'...BBBBBBBBBBBBBBBBBBBB...'
'..BBBBBBBBBBBBBBBBBBBBDD..'
'..BBBEEBBBBBBBBBBEEBBBDD..'
'..BBBEEBBBBBBBBBBEEBBBDD..'
'..BBBBBBBBBBBBBBBBBBBBDD..'
'..BBBBBBBBBBBBBBBBBBBBDD..'
'..BBBBBBBBBBBBBBBBBBBBDD..'
'...BBBBBBBBBBBBBBBBBBDD...'
'...BBBBBBBBBBBBBBBBBBDD...'
'....BBBBBBBBBBBBBBBBDD....'
'.....LL..LL....LL..LL.....'
'.....LL..LL....LL..LL.....'
```

Char language: `B` body clay · `D` dark-clay right edge / ears · `n` ear · `E` eye
(blinks) · `L` stubby leg · `.` transparent. The `M` (muzzle), `o` (nose), and `I`
(tail-ring) chars are simply absent from the new matrices.

### Why dimensions stay 26×14 / 12 body rows

Every scene call site positions the sprite against the current 26-wide footprint
(disco DJ at `W/2 - 22`, surf/nap sitters via `PANDA_BODY_ROWS`, walker via
`PANDA.slice(0, PANDA_BODY_ROWS)`). Keeping the same dimensions makes this a pure pixel
swap with **zero scene repositioning**.

### Derived sprites

`PANDA_BUDDY` (the little companion, 12 wide) and `PANDA_MINI` (notch island, 14 wide)
get the same treatment: blob + pointy ears, muzzle-mask/nose/tail pixels removed. Exact
matrices are finalized during implementation using the render harness (see Verification),
holding their existing widths so their call sites also stay put.

### Code impact

- `pandaColor` already returns `null`/falls through for chars it doesn't recognize and
  keeps working for the ones that remain (`B`, `D`, `n`, `E`, `L`). **No change required.**
  The `M`/`o`/`I` cases become dead branches; leave them (harmless, tolerant) or trim as a
  tidy-up — trimming is optional and not load-bearing.
- `DEFAULT_PALETTE.muzzle` and `.ink` become unused once no matrix contains `M`/`I`.
  Leave them in place (low-risk); removing them is out of scope.
- Rewrite the file's top doc-comment: it currently describes "the red panda … triangular
  ears, a thick horizontal tail with alternating ink/clay rings … a light muzzle." Replace
  with an accurate description of the pointy-eared clay blob.

---

## 2. Scene transition

> **REVISED 2026-07-05 (supersedes the camera-pan design below).** The camera
> pan shipped but read as janky — a hard 1px seam sliced down the middle with
> two mascots butting heads. Replaced with a **loading interstitial**:
>
> 1. **Dissolve out** (`t` 0→0.3): the frozen outgoing scene is replaced 4px
>    block-by-block with the loading beat, using the existing ordered
>    `hash(bx,by) < mix` dither.
> 2. **Working beat** (`t` 0.3→0.7): the blob sits centered doing a bob +
>    alternating foot-tap (gait step) with 1–3 cycling dots (`·`/`··`/`···`)
>    below it. No bar, no text.
> 3. **Dissolve in** (`t` 0.7→1): the loading beat dissolves the same way into
>    the live incoming scene.
>
> Implementation: `pan.ts`/`panGeom` and `drawPan`/the traveler walker are
> removed. New pure module `src/renderer/src/lib/loadingTransition.ts` exports
> `loadingPhase(t) -> { phase: 'out'|'hold'|'in', mix }` (unit-tested). In
> `CoreScene.tsx`, `drawLoadingTransition` + `drawLoading` replace `drawPan`,
> and a shared `ditherBlocks(ctx, src, amount)` helper is extracted (the
> scene⇄constellation composite now uses it too). `TRANS_FRAMES` bumped 24→30
> (~2.5s). Shipped in commit `15843ed`.

## (original) Scene transition: camera pan + traveler walker

### Problem

`drawTransition` in `CoreScene.tsx` collapses every pixel of the outgoing scene into a
tilted orbiting ring at top-center, spins it ~2.6 rad, then flings the pixels into the next
scene, with ink "links" strung between them mid-spin. The swirl draws attention to the
mechanism instead of the scenes. Kimani wants something more natural.

### Decision

Replace it with a **camera pan**: the outgoing vignette slides off-screen left while the
incoming vignette slides in from the right — a camera panning from one little world to the
next. A single **traveler walker** (the mascot, mid walk-cycle) strides across the bottom
during the pan so the eye follows one panda while the worlds swap behind it.

Each scene bakes its panda in at a scene-specific spot/pose/scale, so a single continuous
panda held still across the swap is not realistic without rebuilding all 8 scenes. The
camera pan sidesteps that: each scene (its own panda included) simply slides, and the
foreground traveler supplies the "panda strolled somewhere new" continuity.

### New pure module — `src/renderer/src/lib/pan.ts`

All pan geometry lives in one pure, testable function:

```
panGeom(t: number, W: number) -> {
  dx:          number   // round(easeOutCubic(t) * W): how far both worlds slid left
  seamX:       number   // W - dx: x of the boundary between old and new
  travelerX:   number   // walker x: gentle rightward drift across center-bottom
  showTraveler: boolean // t < 0.8 — traveler stops before the incoming panda fully lands,
                        //           so its own panda never double-ups with the traveler
}
```

`easeOutCubic(t) = 1 - (1 - t)^3` moves into `pan.ts` (currently `ease` in CoreScene;
CoreScene keeps its own copy or imports it — implementer's call, no behavior change).

### `CoreScene.tsx` changes

- Add two `W×H` offscreen buffers (`panFrom`, `panTo`) in the render effect, alongside the
  existing `sceneOff`.
- Replace `drawTransition(...)` with `drawPan(sctx, fromScene, toScene, fromF, frame, t)`:
  1. Render the outgoing scene into `panFrom`, **frozen** at its last pre-transition frame
     (so the departing world doesn't keep animating as it leaves).
  2. Render the incoming scene live into `panTo` at `frame`.
  3. `const { dx, seamX, travelerX, showTraveler } = panGeom(t, W)`
     → `drawImage(panFrom, -dx, 0)`, `drawImage(panTo, W - dx, 0)`.
  4. Draw a 1px `INK` vertical seam at `seamX` (reads as an intentional panel wipe, matches
     the retro-HUD-frame aesthetic).
  5. If `showTraveler`, `drawWalker(sctx, frame, false, travelerX, PAN_GROUND, true)` on a
     fixed low ground line (`PAN_GROUND` constant) so a mascot walks across while the worlds
     pan behind it.
- Call site (~lines 1010–1019): drop the `buildParticles` / `partsSlot` / `parts`
  bookkeeping; just call `drawPan` with `prev` and `sceneIdx`. Integer-pixel offsets only —
  keep it crisp (no fillText, no fractional blits; the pixel-art Core must not anti-alias).

### Deletions (dead once the orbit is gone)

`drawTransition`, `buildParticles`, `samplePixels`, the `Particle` interface, and the
`parts` / `partsSlot` variables.

### Untouched (orthogonal)

Disco-busy lock, napping (no transition while napping), the `slot > 0` first-rotation
guard, and the constellation ⇄ scene dissolve all stay as-is.

### Pan direction & feel

Outgoing exits left, incoming enters right (reads as "moving forward"). `TRANS_FRAMES`
stays ~24 (≈2s); bump slightly if the slide feels rushed. No parallax (scenes are
monolithic renders) — a straight slide is the intended clean look.

---

## Verification

- **Mascot:** render `PANDA`, `PANDA_BUDDY`, `PANDA_MINI` to PNG via the scratchpad render
  harness (minimal `zlib` PNG encoder, `DEFAULT_PALETTE` colors) and eyeball each before
  wiring in — same loop used to design the sprite. Then `npm run dev` and confirm the
  mascot reads correctly in the walker, sitter (surf/nap), DJ (disco), buddy, and notch-mini
  poses.
- **Transition:** unit-test `pan.ts` in `tests/pan.test.ts` — `dx` monotonic in `t`,
  `dx(0)=0` and `dx(1)=W`, `seamX` in `[0, W]`, `showTraveler` false past `t=0.8`. Then
  `npm test`, typecheck, and `npm run dev` to watch a full scene rotation (~22s cadence) and
  confirm the pan + walker feels natural and stays pixel-crisp.
