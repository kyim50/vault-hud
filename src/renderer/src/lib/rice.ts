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
  if (b.sprites !== undefined && !Array.isArray(b.sprites)) return { ok: false, error: 'sprites must be an array' }
  if (b.themes !== undefined && (typeof b.themes !== 'object' || b.themes === null || Array.isArray(b.themes))) {
    return { ok: false, error: 'themes must be an object' }
  }
  return { ok: true, bundle: { v: 1, ui: b.ui as UiConfig, themes: b.themes, sprites: b.sprites } }
}
