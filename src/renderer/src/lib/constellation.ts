import type { GraphNode, LinkGraph } from '@shared/types'

// Star layout for the constellation graph: deterministic (same workspace →
// same sky), collision-relaxed, capped to the most connected + freshest
// notes so the canvas stays readable at 192×108.

export interface Star {
  x: number
  y: number
  node: GraphNode
  // 0 = the focused note · 1 = directly linked · 2 = second degree ·
  // 3 = background sky (unrelated or no focus active)
  ring: 0 | 1 | 2 | 3
}

export const MAX_STARS = 40

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967296
}

function strHash(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

export function layoutStars(
  graph: LinkGraph,
  w: number,
  h: number
): { stars: Star[]; edges: [number, number][] } {
  // rank: most linked first, then freshest — those are the notes worth a star
  const ranked = graph.nodes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => b.n.links - a.n.links || b.n.mtime - a.n.mtime)
    .slice(0, MAX_STARS)
  const keep = new Map<number, number>() // original index → star index
  ranked.forEach((r, si) => keep.set(r.i, si))

  // golden-angle spiral from the center: even spread at any node count,
  // with per-note hash jitter so the sky stays organic and deterministic
  const stars: Star[] = []
  const cx = w / 2
  const cy = h / 2 - 6
  const rx = w * 0.42
  const ry = h * 0.36
  const MIN_D2 = 12 * 12
  ranked.forEach(({ n }, i) => {
    const seed = strHash(n.title)
    let x = 0
    let y = 0
    for (let attempt = 0; attempt < 6; attempt++) {
      const a = i * 2.39996 + hash(seed, attempt) * 1.2
      const rr = Math.sqrt((i + 0.6) / Math.max(1, ranked.length)) * (0.55 + hash(seed, attempt + 9) * 0.45)
      x = cx + Math.cos(a) * rx * rr
      y = cy + Math.sin(a) * ry * rr
      if (stars.every((s) => (s.x - x) ** 2 + (s.y - y) ** 2 >= MIN_D2)) break
    }
    stars.push({ x: Math.round(x), y: Math.round(y), node: n, ring: 3 })
  })

  const edges: [number, number][] = []
  for (const [a, b] of graph.edges) {
    const sa = keep.get(a)
    const sb = keep.get(b)
    if (sa !== undefined && sb !== undefined) edges.push([sa, sb])
  }
  return { stars, edges }
}

// Contextual layout for a hovered note: the note itself pulls to the
// center, its direct wiki-links orbit on a labeled inner ring, their links
// form an outer ring, and everything unrelated recedes to background sky.
export function layoutConstellation(
  graph: LinkGraph,
  w: number,
  h: number,
  focusRel: string | null
): { stars: Star[]; edges: [number, number][] } {
  const base = layoutStars(graph, w, h)
  const fi = focusRel === null ? -1 : base.stars.findIndex((s) => s.node.relPath === focusRel)
  if (fi < 0) return base

  const neighbors = new Set<number>()
  for (const [a, b] of base.edges) {
    if (a === fi) neighbors.add(b)
    if (b === fi) neighbors.add(a)
  }
  const second = new Set<number>()
  for (const [a, b] of base.edges) {
    if (neighbors.has(a) && b !== fi && !neighbors.has(b)) second.add(b)
    if (neighbors.has(b) && a !== fi && !neighbors.has(a)) second.add(a)
  }

  const cx = w / 2
  const cy = h / 2 - 6
  const place = (list: number[], rx: number, ry: number, phase: number): void => {
    list.forEach((si, k) => {
      const a = -Math.PI / 2 + (k / Math.max(1, list.length)) * Math.PI * 2 + phase
      base.stars[si] = {
        ...base.stars[si],
        x: Math.round(cx + Math.cos(a) * rx),
        y: Math.round(cy + Math.sin(a) * ry)
      }
    })
  }
  base.stars[fi] = { ...base.stars[fi], x: Math.round(cx), y: Math.round(cy), ring: 0 }
  const nb = [...neighbors].sort((a, b) => base.stars[b].node.links - base.stars[a].node.links)
  const sc = [...second]
  place(nb, w * 0.27, h * 0.27, 0)
  place(sc, w * 0.42, h * 0.4, 0.35)
  nb.forEach((si) => (base.stars[si] = { ...base.stars[si], ring: 1 }))
  sc.forEach((si) => (base.stars[si] = { ...base.stars[si], ring: 2 }))
  return base
}

// nearest star within reach of a canvas-space point (for hover + click)
export function hitStar(stars: Star[], x: number, y: number, radius = 9): number {
  let best = -1
  let bestD = radius * radius
  stars.forEach((s, i) => {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}
