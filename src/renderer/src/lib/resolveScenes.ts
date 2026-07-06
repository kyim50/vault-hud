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
  const requested = (Array.isArray(cfg?.rotation) ? cfg.rotation : []).filter((n) => valid.has(n))
  const rotation = requested.length > 0 ? requested : defaults
  const rawSec = typeof cfg?.intervalSec === 'number' && Number.isFinite(cfg.intervalSec) ? cfg.intervalSec : 22
  const sec = Math.max(3, Math.min(600, rawSec))
  return {
    rotation,
    intervalFrames: Math.round(sec * fps),
    busy: cfg?.busy && valid.has(cfg.busy) ? cfg.busy : 'disco',
    nap: cfg?.nap && valid.has(cfg.nap) ? cfg.nap : 'nap'
  }
}
