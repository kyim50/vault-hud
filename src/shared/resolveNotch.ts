import type { NotchConfig } from './types'

export interface ResolvedNotch {
  enabled: boolean
  width: number
  expandedHeight: number
}

export const NOTCH_BOUNDS = {
  width: [240, 900],
  expandedHeight: [80, 600]
} as const

function clampNum(v: unknown, def: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def
}

export function resolveNotch(cfg: NotchConfig | undefined): ResolvedNotch {
  return {
    enabled: typeof cfg?.enabled === 'boolean' ? cfg.enabled : true,
    width: clampNum(cfg?.width, 440, NOTCH_BOUNDS.width[0], NOTCH_BOUNDS.width[1]),
    expandedHeight: clampNum(cfg?.expandedHeight, 140, NOTCH_BOUNDS.expandedHeight[0], NOTCH_BOUNDS.expandedHeight[1])
  }
}
