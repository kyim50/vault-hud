import type { PanelLayout } from '@shared/types'

// Canonical default layout — reproduces the pre-zones HUD exactly.
export const DEFAULT_ZONES: string[][] = [
  ['fetch', 'vitals', 'directives', 'brain'],
  ['core'],
  ['deck', 'schedule', 'totem', 'skills']
]

// config `ui.layout` → sanitized zones. Fail-soft at the user-JSON boundary:
// migrates legacy {left,right}, drops unknown/duplicate ids, and never returns
// zero or all-empty zones (that would blank the HUD).
export function resolveLayout(cfg: PanelLayout | undefined, validIds: Set<string>): string[][] {
  const seen = new Set<string>()
  const cleanZone = (arr: unknown): string[] =>
    (Array.isArray(arr) ? arr : []).filter(
      (id): id is string => typeof id === 'string' && validIds.has(id) && !seen.has(id) && !!seen.add(id)
    )

  let raw: unknown[]
  if (Array.isArray(cfg?.zones)) {
    raw = cfg!.zones
  } else if (Array.isArray(cfg?.left) || Array.isArray(cfg?.right)) {
    // legacy migration: two columns become [left, [core], right]
    raw = [cfg?.left ?? [], ['core'], cfg?.right ?? []]
  } else {
    return DEFAULT_ZONES.map((z) => [...z])
  }

  const zones = raw.map(cleanZone)
  if (zones.length === 0 || zones.every((z) => z.length === 0)) {
    return DEFAULT_ZONES.map((z) => [...z])
  }
  return zones
}
