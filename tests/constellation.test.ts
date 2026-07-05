import { describe, it, expect } from 'vitest'
import { layoutStars, layoutConstellation, hitStar, MAX_STARS } from '../src/renderer/src/lib/constellation'
import type { LinkGraph } from '../src/shared/types'

const graph = (n: number, edges: [number, number][] = []): LinkGraph => ({
  nodes: Array.from({ length: n }, (_, i) => ({
    title: `Note ${i}`,
    relPath: `Note ${i}.md`,
    mtime: i,
    links: edges.filter((e) => e.includes(i)).length
  })),
  edges
})

describe('layoutStars', () => {
  it('is deterministic and stays inside the canvas', () => {
    const g = graph(20, [[0, 1], [1, 2]])
    const a = layoutStars(g, 192, 108)
    const b = layoutStars(g, 192, 108)
    expect(a.stars.map((s) => [s.x, s.y])).toEqual(b.stars.map((s) => [s.x, s.y]))
    for (const s of a.stars) {
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x).toBeLessThan(192)
      expect(s.y).toBeGreaterThanOrEqual(0)
      expect(s.y).toBeLessThan(108)
    }
  })
  it('caps stars and remaps edges to surviving nodes only', () => {
    const g = graph(80, [[0, 1], [70, 79]])
    const { stars, edges } = layoutStars(g, 192, 108)
    expect(stars.length).toBe(MAX_STARS)
    for (const [a, b] of edges) {
      expect(a).toBeLessThan(stars.length)
      expect(b).toBeLessThan(stars.length)
    }
  })
  it('ranks linked notes above lonely ones', () => {
    const g = graph(60, [[0, 1], [0, 2], [0, 3]])
    const { stars } = layoutStars(g, 192, 108)
    expect(stars[0].node.title).toBe('Note 0')
  })
})

describe('layoutConstellation', () => {
  //   0 — 1 — 3     (2 also linked to 0; 4 is a stranger)
  const g = graph(5, [[0, 1], [0, 2], [1, 3]])

  it('centers the focused note and rings its neighborhood', () => {
    const { stars } = layoutConstellation(g, 192, 108, 'Note 0.md')
    const focus = stars.find((s) => s.node.relPath === 'Note 0.md')!
    expect(focus.ring).toBe(0)
    expect(focus.x).toBe(96)
    const n1 = stars.find((s) => s.node.relPath === 'Note 1.md')!
    const n2 = stars.find((s) => s.node.relPath === 'Note 2.md')!
    const n3 = stars.find((s) => s.node.relPath === 'Note 3.md')!
    const n4 = stars.find((s) => s.node.relPath === 'Note 4.md')!
    expect(n1.ring).toBe(1)
    expect(n2.ring).toBe(1)
    expect(n3.ring).toBe(2) // linked to a neighbor, not to the focus
    expect(n4.ring).toBe(3) // stranger stays background sky
    // inner ring sits closer to the focus than the outer ring
    const d = (s: { x: number; y: number }) => (s.x - focus.x) ** 2 + (s.y - focus.y) ** 2
    expect(d(n1)).toBeLessThan(d(n3))
  })

  it('falls back to the spiral when the focus is unknown or null', () => {
    expect(layoutConstellation(g, 192, 108, null)).toEqual(layoutStars(g, 192, 108))
    expect(layoutConstellation(g, 192, 108, 'Nope.md')).toEqual(layoutStars(g, 192, 108))
  })
})

describe('hitStar', () => {
  it('finds the nearest star within radius, else -1', () => {
    const { stars } = layoutStars(graph(5), 192, 108)
    const target = stars[2]
    expect(hitStar(stars, target.x + 2, target.y - 1)).toBe(2)
    expect(hitStar(stars, -50, -50)).toBe(-1)
  })
})
