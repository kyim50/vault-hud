import type { CustomScene, SceneProp } from '@shared/types'

const SKY_DEFAULT: [string, string] = ['#12131a', '#05060a']
const GROUND_DEFAULT = '#0e1013'

// only valid CSS hex lengths (3/4/6/8) — 5- and 7-digit strings are NOT valid
// colors and would throw in ctx.addColorStop (freezing the scene loop)
const hex = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v.trim()) ? v.trim() : fallback
const clamp = (v: unknown, min: number, max: number, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def

function cleanProp(p: unknown, validSpriteNames: Set<string>): SceneProp | null {
  if (typeof p !== 'object' || p === null) return null
  const o = p as Record<string, unknown>
  if (typeof o.sprite !== 'string' || !validSpriteNames.has(o.sprite)) return null
  return {
    sprite: o.sprite,
    x: clamp(o.x, 0, 100, 50),
    y: clamp(o.y, 0, 100, 50),
    scale: clamp(o.scale, 1, 4, 2),
    drift: !!o.drift
  }
}

// sanitize one user scene; null if unusable (bad/empty/reserved name).
export function resolveCustomScene(
  scene: unknown,
  validSpriteNames: Set<string>,
  reserved: Set<string>
): CustomScene | null {
  if (typeof scene !== 'object' || scene === null) return null
  const o = scene as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (!name || reserved.has(name)) return null
  const skyArr = Array.isArray(o.sky) ? o.sky : []
  const sky: [string, string] = [hex(skyArr[0], SKY_DEFAULT[0]), hex(skyArr[1], SKY_DEFAULT[1])]
  const props = (Array.isArray(o.props) ? o.props : [])
    .map((p) => cleanProp(p, validSpriteNames))
    .filter((p): p is SceneProp => p !== null)
  return { name, sky, ground: hex(o.ground, GROUND_DEFAULT), props }
}

// sanitize the list; drops nulls and later duplicates of a name.
export function resolveCustomScenes(
  list: unknown,
  validSpriteNames: Set<string>,
  reserved: Set<string>
): CustomScene[] {
  const seen = new Set<string>()
  const out: CustomScene[] = []
  for (const s of Array.isArray(list) ? list : []) {
    const c = resolveCustomScene(s, validSpriteNames, reserved)
    if (c && !seen.has(c.name)) {
      seen.add(c.name)
      out.push(c)
    }
  }
  return out
}
