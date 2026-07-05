import type { GeometryConfig } from '@shared/types'

export interface ResolvedGeometry {
  leftWidth: number
  rightWidth: number
  coreMax: number
}

// clamp bounds — single source shared by the drag handlers and Settings steppers
export const GEOMETRY_BOUNDS = {
  leftWidth: [180, 460],
  rightWidth: [180, 460],
  coreMax: [360, 1000]
} as const

// finite number → clamped to [min,max]; anything else → default (fail-soft at the
// user-editable-JSON boundary, same lesson as resolveScenes)
function clampNum(v: unknown, def: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def
}

export function resolveGeometry(cfg: GeometryConfig | undefined): ResolvedGeometry {
  return {
    leftWidth: clampNum(cfg?.leftWidth, 280, GEOMETRY_BOUNDS.leftWidth[0], GEOMETRY_BOUNDS.leftWidth[1]),
    rightWidth: clampNum(cfg?.rightWidth, 300, GEOMETRY_BOUNDS.rightWidth[0], GEOMETRY_BOUNDS.rightWidth[1]),
    coreMax: clampNum(cfg?.coreMax, 560, GEOMETRY_BOUNDS.coreMax[0], GEOMETRY_BOUNDS.coreMax[1])
  }
}
