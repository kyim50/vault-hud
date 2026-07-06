# Artwork Authoring — Scene Studio + custom mascot

Date: 2026-07-06
Surface: `src/shared/types.ts` + new `lib/resolveCustomScene.ts` +
new `lib/drawCustomScene.ts` + `components/CoreScene.tsx` +
`components/VaultfetchPanel.tsx` + `main/sprites.ts` +
`components/settings/ScenesTab.tsx` (+ `SpritesTab.tsx`)

Sub-project **H** of the vault-hud arc — the first *artwork authoring* piece,
answering Kimani's ask to make the Core/vaultfetch artwork user-authored, not
just recolored. It lets a user **compose their own Core scenes** from the
sprites they make in Sprite Studio, and **use a custom sprite as the mascot**.

## Honest scope

The built-in Core scenes are richly hand-animated imperative canvas code
(dithered clouds, moving water, a posed/blinking mascot). v1 does **not** redraw
those or animate custom art per-frame. It delivers:

1. **Custom scenes** — a *declarative* scene (sky gradient + ground band + your
   sprites placed by percentage, with gentle ambient drift/bob) that renders
   **alongside** the built-ins and rotates through the same machinery.
2. **Custom mascot** — a sprite marked `mascot` replaces the panda in the
   vaultfetch logo (and is a placeable prop in scenes).

Per-frame pose animation of custom art and a drag-on-canvas editor are explicit
non-goals for v1 (numeric placement + a live preview instead).

## Data model

`CustomSprite.use` gains `'mascot'` (exclusive, like `'totem'` — one at a time):

```ts
export interface CustomSprite {
  name: string
  grid: string[][]
  use: 'frame' | 'totem' | 'mascot' | 'none'
}
```

A custom scene is declarative and lives on the UI config:

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
// UiConfig gains:
customScenes?: CustomScene[]
```

## Pure resolver (`lib/resolveCustomScene.ts`, unit-tested)

```ts
resolveCustomScene(scene, validSpriteNames: Set<string>, reserved: Set<string>): CustomScene | null
resolveCustomScenes(list, validSpriteNames, reserved): CustomScene[]
```

- Drops a scene whose `name` is empty, non-string, reserved (a built-in name), or
  a duplicate of an earlier custom scene.
- `sky` → two valid hex strings (fallback `['#12131a', '#05060a']`); `ground` →
  hex (fallback `#0e1013`) — fail-soft on non-strings.
- `props` → array; each prop kept only if `sprite ∈ validSpriteNames`; `x`,`y`
  clamped `[0,100]`, `scale` clamped `[1,4]`, `drift` coerced boolean. Unknown
  sprites are dropped (a renamed/deleted sprite never crashes a scene).
- Never throws; returns clean scenes or `null`.

## Renderer (`lib/drawCustomScene.ts`)

```ts
drawCustomScene(ctx, scene: CustomScene, spritesByName: Map<string,string[][]>, f: number, W: number, H: number): void
```

Draws: a vertical **sky** gradient over `W×H`; a **ground** band below a fixed
horizon (`~H*0.78`); then each prop's sprite grid at its `x%,y%` center, scaled,
with optional **ambient motion** — `drift` adds `sin(f/90)*6px` horizontal and a
1–2px bob so the scene breathes. A prop whose sprite isn't in the map is skipped.
Pure drawing (no state); tested by rendering behavior in `npm run dev`.

## Registry integration (`CoreScene.tsx`)

The name-keyed `SCENE_REGISTRY` (from sub-project B) makes this clean. CoreScene
builds runtime entries from the resolved custom scenes and **merges** them:

```ts
const spritesByName = new Map(snap.sprites.map((s) => [s.name, s.grid]))
const custom = resolveCustomScenes(snap.ui.customScenes, new Set(spritesByName.keys()), new Set(SCENE_NAMES))
const registry = { ...SCENE_REGISTRY, ...Object.fromEntries(custom.map((s) => [
  s.name, { name: s.name, horizon: Math.round(H * 0.78), draw: (c, f) => drawCustomScene(c, s, spritesByName, f, W, H) }
])) }
```

The loop then resolves scene names against `Object.keys(registry)` and looks
draw fns up in `registry` (replacing the module-const references). No-config
behavior is unchanged: with no custom scenes the merged registry equals the
built-in one exactly (parity).

## Custom mascot (`VaultfetchPanel.tsx`, `main/sprites.ts`)

- `VaultfetchPanel` already renders `PANDA_MINI` on a canvas. When a
  `use:'mascot'` sprite exists, it draws that sprite's grid (in the sprite's own
  colors) instead; otherwise the themed panda (unchanged).
- `main/sprites.ts`: add `'mascot'` to the `sane()` allow-list and make it
  **exclusive** (assigning mascot clears any other mascot), mirroring `'totem'`.
- `SpritesTab` save-target chips gain a `mascot` option.

## Authoring UI — "Scene Studio" (`ScenesTab.tsx`)

A new section under Scenes:

- **Sky** two color inputs + **Ground** one (seeded from the active theme's
  bg/surface). A **live preview** `<canvas>` renders the in-progress scene via
  `drawCustomScene` each change.
- **Props:** an "add sprite" picker over the library; per prop a row with
  x / y / scale steppers, a drift toggle, and remove. (Numeric placement, not
  drag — precise and low-risk for v1.)
- A **name** field + **Save scene**; the saved scene writes to
  `ui.customScenes` (spread) and can be checked into the rotation.
- The rotation checklist and the busy/nap pickers include custom scene names
  (built-ins ⊕ `ui.customScenes` names), so a custom scene rotates like any
  other.

All writes spread the current slice; a saved scene with no props still renders
(sky + ground).

## Rides the rice · fail-soft

Custom scenes (`ui.customScenes`) and the mascot sprite already travel in the
**rice bundle** (G's `ui` + `sprites`), so an authored world exports/imports as
one file. Every boundary is fail-soft: bad colors, out-of-range positions,
unknown/renamed sprites, reserved/duplicate names all degrade rather than crash.

## Files

| File | Change |
|---|---|
| `shared/types.ts` | `CustomSprite.use += 'mascot'`; `SceneProp`, `CustomScene`; `UiConfig.customScenes?`. |
| `lib/resolveCustomScene.ts` | **New, pure.** sanitize/fail-soft. Unit-tested. |
| `lib/drawCustomScene.ts` | **New.** canvas composer. |
| `components/CoreScene.tsx` | merge custom scenes into the registry; resolve names against the merged set. |
| `components/VaultfetchPanel.tsx` | draw the `mascot` sprite when set. |
| `main/sprites.ts` | allow + exclusive `'mascot'`. |
| `components/settings/ScenesTab.tsx` | Scene Studio + custom names in rotation/busy/nap. |
| `components/settings/SpritesTab.tsx` | `mascot` save target. |
| `tests/resolveCustomScene.test.ts` | **New.** |

## Testing

- **`resolveCustomScene`** (TDD): valid scene passes; empty/non-string/reserved/
  duplicate name → dropped; bad sky/ground → fallback; prop with unknown sprite
  dropped; x/y clamp `[0,100]`, scale clamp `[1,4]`, drift coerced; never throws.
- **Registry parity** test: with no custom scenes the merged registry keys equal
  `SCENE_NAMES`.
- **Renderer / mascot / Scene Studio** — manual in `npm run dev`: compose a
  scene from a sprite, add it to rotation, watch it appear in the Core; set a
  mascot sprite and see the vaultfetch logo change; export→import the rice and
  confirm the authored scene travels.
