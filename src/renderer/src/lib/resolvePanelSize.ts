import type { ModuleConfig } from '@shared/types'

// panels that soak leftover column height by default (was the hardcoded GROWS
// set in App). Single source of truth, imported by App and the Layout tab.
export const DEFAULT_GROW = new Set(['brain', 'skills', 'core'])

const HEIGHT_MIN = 80
const HEIGHT_MAX = 900

// grow ⊕ height: a growing panel fills leftover height (height ignored); a
// fixed-height panel scrolls inside its box; neither → hug content. Fail-soft
// at the user-JSON boundary.
export function resolvePanelSize(
  cfg: ModuleConfig | undefined,
  isDefaultGrow: boolean
): { grow: boolean; height: number | null } {
  const grow = typeof cfg?.grow === 'boolean' ? cfg.grow : isDefaultGrow
  if (grow) return { grow: true, height: null }
  const h = cfg?.height
  const height =
    typeof h === 'number' && Number.isFinite(h) ? Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, h)) : null
  return { grow: false, height }
}
