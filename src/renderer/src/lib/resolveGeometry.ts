import type { GeometryConfig } from '@shared/types'

export interface ResolvedGeometry {
  zoneWidths: number[] // length === zoneCount; the flex zone's entry is ignored for layout
  flexZone: number // index of the `1fr` zone
  coreMax: number
}

// clamp bounds — single source shared by the drag handlers and Settings
export const GEOMETRY_BOUNDS = {
  zoneWidth: [180, 460],
  coreMax: [360, 1000]
} as const

// per-index default widths: reproduce the pre-zones HUD (280 / flex / 300);
// any zone beyond the original three defaults to 260.
const DEFAULT_ZONE_WIDTHS = [280, 260, 300]
const defaultWidth = (i: number): number => DEFAULT_ZONE_WIDTHS[i] ?? 260

function clampNum(v: unknown, def: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def
}

export function resolveCoreMax(cfg: GeometryConfig | undefined): number {
  return clampNum(cfg?.coreMax, 560, GEOMETRY_BOUNDS.coreMax[0], GEOMETRY_BOUNDS.coreMax[1])
}

export function resolveGeometry(cfg: GeometryConfig | undefined, zoneCount: number, coreZone = -1): ResolvedGeometry {
  const count = Math.max(1, Math.floor(zoneCount) || 1)
  const legacy = typeof cfg?.leftWidth === 'number' || typeof cfg?.rightWidth === 'number'

  let raw: unknown[]
  if (Array.isArray(cfg?.zoneWidths)) raw = cfg!.zoneWidths
  else if (legacy) raw = [cfg?.leftWidth, defaultWidth(1), cfg?.rightWidth]
  else raw = []

  const [wmin, wmax] = GEOMETRY_BOUNDS.zoneWidth
  const zoneWidths = Array.from({ length: count }, (_, i) => clampNum(raw[i], defaultWidth(i), wmin, wmax))

  const rawFlex =
    typeof cfg?.flexZone === 'number' && Number.isFinite(cfg.flexZone)
      ? Math.floor(cfg.flexZone)
      : legacy
        ? 1
        : coreZone >= 0
          ? coreZone
          : Math.floor(count / 2)
  const flexZone = Math.max(0, Math.min(count - 1, rawFlex))

  return { zoneWidths, flexZone, coreMax: resolveCoreMax(cfg) }
}
