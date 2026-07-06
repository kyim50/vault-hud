# Core Scene Customization — curate the built-in scenes from config

Date: 2026-07-05
Surface: `src/renderer/src/components/CoreScene.tsx` + a new pure `lib/resolveScenes.ts`
+ `src/shared/types.ts` + `SettingsPanel.tsx` + `App.tsx`

## Part A — Vision & place in the roadmap

Sub-project **B** of the vault-hud customization arc (see [[project-vault-hud-customization]]).
Lets the user curate the Core's rotating scenes from their rice config: pick which of the
8 built-in scenes rotate, in what order, how long each shows, and which scene plays for
the busy (command-running) and nap (idle) states. Authoring **brand-new** scenes is
explicitly a later, larger sub-project (pixel scenes are imperative canvas code today and
would need a scene-description format) — out of scope here.

All customization sub-projects accumulate on the `vaultfetch` branch and merge together at
the end. Repo rule: **no Claude co-author trailer** on any commit.

## Part B — The problem: scenes are keyed by array index

Today `CoreScene.tsx` holds:
- `const SCENES = [sceneMeadow, sceneSurf, sceneGarden, sceneDisco, sceneGlobe, sceneNight, sceneRain, sceneRooftop]` — order and membership are hardcoded.
- `const DISCO = 3` — the busy scene, referenced by index.
- `const HORIZONS: Record<number, number>` — per-index ground line for loot placement.
- Rotation: `slot = floor(frame / SCENE_FRAMES)`, `sceneIdx = busy ? DISCO : slot % SCENES.length`, with `SCENE_FRAMES = 22 * FPS` (FPS = 12).
- A separate `sceneNap` shown when `mood === 'napping'`.
- `drawLoadingTransition(..., fromScene: number, toScene: number, ...)` takes scene **indices** and calls `SCENES[fromScene]` / `SCENES[toScene]` internally.

Index-keying makes config fragile (`3` is meaningless to a user, and reordering the array
would silently change behavior). The fix is a **name-keyed registry**.

## Part C — Data model

### Scene registry (in `CoreScene.tsx`, where the draw fns live)

```ts
type SceneFn = (ctx: Ctx, f: number, blink: boolean) => void
interface SceneDef { name: string; draw: SceneFn; horizon?: number }

// every drawable scene, including the special nap scene
const SCENE_REGISTRY: Record<string, SceneDef> = {
  meadow:  { name: 'meadow',  draw: sceneMeadow,  horizon: 90 },
  surf:    { name: 'surf',    draw: sceneSurf },
  garden:  { name: 'garden',  draw: sceneGarden,  horizon: 92 },
  disco:   { name: 'disco',   draw: sceneDisco,   horizon: 94 },
  globe:   { name: 'globe',   draw: sceneGlobe },
  night:   { name: 'night',   draw: sceneNight,   horizon: 92 },
  rain:    { name: 'rain',    draw: sceneRain,    horizon: 92 },
  rooftop: { name: 'rooftop', draw: sceneRooftop, horizon: 88 },
  nap:     { name: 'nap',     draw: sceneNap }
}

// canonical rotation order + defaults for the special states
const ROTATION_DEFAULT = ['meadow', 'surf', 'garden', 'disco', 'globe', 'night', 'rain', 'rooftop']
```

(Horizon values are lifted verbatim from today's `HORIZONS` map: meadow 90, garden 92,
disco 94, night 92, rain 92, rooftop 88; surf/globe/nap have none.)

### Config slice (`ui.scenes`)

```ts
interface SceneConfig {
  rotation?: string[]   // scenes that cycle, in order — default ROTATION_DEFAULT
  intervalSec?: number  // seconds per scene — default 22, clamped to [3, 600]
  busy?: string         // scene while a command runs — default 'disco'
  nap?: string          // scene after 90min idle — default 'nap'
}
```

Added to `UiConfig` as `scenes?: SceneConfig`. It rides the snapshot via the existing
`ui: { ...config.ui }` and merges fail-soft through `mergeConfig`'s `ui` spread — no
main-process change needed beyond the type.

### Resolver (pure, testable) — `lib/resolveScenes.ts`

```ts
interface ResolvedScenes {
  rotation: string[]     // valid names, in order; never empty
  intervalFrames: number // round(intervalSec * fps), clamped
  busy: string           // valid registry name
  nap: string            // valid registry name
}

export function resolveScenes(
  cfg: SceneConfig | undefined,
  validNames: string[],       // Object.keys(SCENE_REGISTRY)
  defaults: string[],         // ROTATION_DEFAULT
  fps: number                 // 12
): ResolvedScenes
```

Rules:
- `rotation` = `cfg.rotation` filtered to names in `validNames`; if the result is empty
  (missing, all-invalid, or `[]`), fall back to `defaults`. Never returns an empty list —
  the Core must always have something to show.
- `intervalFrames` = `round(clamp(cfg.intervalSec ?? 22, 3, 600) * fps)`.
- `busy` = `cfg.busy` if in `validNames`, else `'disco'`.
- `nap` = `cfg.nap` if in `validNames`, else `'nap'`.

Pure — no canvas/DOM dependency (operates on names + numbers), so fully unit-tested.
CoreScene maps the resolved names back to `SceneDef`s via `SCENE_REGISTRY`.

## Part D — CoreScene wiring

- `CoreScene` gains a `scenes?: SceneConfig` prop; `App.tsx` passes `scenes={snap.ui.scenes}`.
- Resolve once with `useMemo` keyed on the prop:
  `const scn = useMemo(() => resolveScenes(scenes, Object.keys(SCENE_REGISTRY), ROTATION_DEFAULT, FPS), [scenes])`.
  Keep it in a ref (like the other loop inputs) so the animation loop reads the latest.
- In the loop:
  - `SCENE_FRAMES` → `scnRef.current.intervalFrames`.
  - `const entry = busyRef.current ? SCENE_REGISTRY[scn.busy] : SCENE_REGISTRY[scn.rotation[slot % scn.rotation.length]]`.
  - Draw with `entry.draw(sctx, frame, blink)`; loot horizon = `entry.horizon` (skip loot when undefined).
  - Nap branch draws `SCENE_REGISTRY[scn.nap].draw`.
  - Transition: compute `prevEntry` = `SCENE_REGISTRY[scn.rotation[(slot - 1 + n) % n]]` and pass
    `prevEntry.draw` / `entry.draw` to `drawLoadingTransition`.
- `drawLoadingTransition` signature changes: `fromScene: number` / `toScene: number` →
  `fromDraw: SceneFn` / `toDraw: SceneFn`; its internal `SCENES[fromScene]` / `SCENES[toScene]`
  calls become `fromDraw(...)` / `toDraw(...)`.
- The module constants `SCENES`, `DISCO`, and `HORIZONS` are removed (replaced by the
  registry). `sceneNap` joins the registry as `nap`.

Behavior with no config present is identical to today: all 8 scenes, 22s each, disco when
busy, nap when idle.

## Part E — Settings UI

A new "Scenes" section in `SettingsPanel.tsx`:
- A **checklist** of the 8 rotation-eligible scenes (`ROTATION_DEFAULT`). Checked = in
  rotation. Toggling writes the canonical-ordered subset of checked names.
- An **interval control** (+/− stepper or slider) bound to `intervalSec`.
- Because `updateConfig` shallow-merges (`Object.assign(config.ui, patch.ui)`), every write
  MUST spread the current scenes object so unrelated fields survive:
  `window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, rotation: next } } })`
  (and likewise for `intervalSec`).
- Guard: never let the user uncheck the last scene — keep at least one checked (the
  resolver also defends this, but the UI should not present an empty state).

Explicit reordering, and `busy`/`nap` pickers, are config-file-driven for now (a Settings
picker for them is a future polish, not required here).

## Part F — Testing

- `tests/resolveScenes.test.ts` — TDD:
  - no config → `{ rotation: all 8, intervalFrames: 264, busy: 'disco', nap: 'nap' }` (22×12).
  - invalid names filtered; a rotation of `['meadow', 'nope', 'night']` → `['meadow', 'night']`.
  - empty/all-invalid rotation → falls back to all 8.
  - `intervalSec` clamped: `1` → 3s (36 frames), `9999` → 600s; a normal `10` → 120 frames.
  - `busy`/`nap` invalid → defaults; valid custom (`busy: 'night'`) respected.
- `tests/scenes-registry.test.ts` (or fold into the above) — every `ROTATION_DEFAULT` name
  and the `disco`/`nap` defaults exist as keys in `SCENE_REGISTRY`.
- Manual (`npm run dev`): uncheck several scenes → only the checked ones cycle; change the
  interval → rotation speed changes; set `ui.scenes.busy`/`nap` in config → those scenes
  show on command-run / after idle; confirm the loading transition still plays correctly
  between arbitrary scene pairs.

## Out of scope

- Authoring brand-new scenes (needs a scene-description format / plugin API) — a later
  sub-project.
- Drag-reorder and busy/nap **pickers** in Settings (config-driven for now).
- Sub-project C (resizing / geometry).
- Per-scene interval overrides (single global interval only).
