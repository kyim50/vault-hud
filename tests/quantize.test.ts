import { describe, it, expect } from 'vitest'
import {
  medianCut,
  backgroundMask,
  crunchImageData,
  mergePalette,
  despeckle,
  type RGB
} from '../src/renderer/src/lib/quantize'

// build RGBA data from a grid of [r,g,b,a] tuples
function rgba(pixels: number[][]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach((p, i) => data.set(p, i * 4))
  return data
}

describe('medianCut', () => {
  it('recovers distinct colors exactly when they fit the budget', () => {
    const colors: RGB[] = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0]
    ]
    const pixels: RGB[] = colors.flatMap((c) => Array.from({ length: 25 }, () => [...c] as RGB))
    const palette = medianCut(pixels, 4)
    expect(palette).toHaveLength(4)
    for (const c of colors) {
      expect(palette).toContainEqual(c)
    }
  })

  it('keeps more than the old 5 fixed inks for colorful input', () => {
    // 10 well-separated colors → at least 8 should survive a 12-color budget
    const colors: RGB[] = Array.from({ length: 10 }, (_, i) => [i * 25, 255 - i * 25, (i * 80) % 255] as RGB)
    const pixels: RGB[] = colors.flatMap((c) => Array.from({ length: 9 }, () => [...c] as RGB))
    expect(medianCut(pixels, 12).length).toBeGreaterThanOrEqual(8)
  })

  it('handles empty and flat input', () => {
    expect(medianCut([], 8)).toEqual([])
    expect(medianCut([[9, 9, 9], [9, 9, 9]], 8)).toEqual([[9, 9, 9]])
  })
})

describe('backgroundMask', () => {
  // 6x6: uniform gray backdrop, red 2x2 subject in the middle with one
  // gray pixel INSIDE the subject (must survive — not connected to border)
  const W = 6
  const gray = [128, 128, 128, 255]
  const red = [200, 30, 30, 255]
  const img: number[][] = []
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const inSubject = x >= 2 && x <= 4 && y >= 2 && y <= 4
      const enclosedGray = x === 3 && y === 3
      img.push(inSubject && !enclosedGray ? red : inSubject ? gray : gray)
    }
  }

  it('masks the connected backdrop but not enclosed same-color pixels', () => {
    const mask = backgroundMask(rgba(img), W, 6)
    expect(mask[0]).toBe(true) // corner backdrop
    expect(mask[2 * W + 2]).toBe(false) // subject
    expect(mask[3 * W + 3]).toBe(false) // gray pixel enclosed by subject survives
  })

  it('keeps everything when the border is already transparent', () => {
    const transparent = img.map((p, i) => (i < W || i >= img.length - W ? [0, 0, 0, 0] : p))
    const mask = backgroundMask(rgba(transparent), W, 6)
    expect(mask.every((m) => !m)).toBe(true)
  })

  it('keeps everything when the border is too varied to be a backdrop', () => {
    const busy = img.map((_, i) => [(i * 53) % 255, (i * 131) % 255, (i * 197) % 255, 255])
    const mask = backgroundMask(rgba(busy), W, 6)
    expect(mask.every((m) => !m)).toBe(true)
  })
})

describe('mergePalette', () => {
  it('collapses near-twin colors but keeps distinct ones', () => {
    const merged = mergePalette([
      [120, 120, 120],
      [125, 122, 118], // near-twin of the first gray
      [220, 40, 40]
    ])
    expect(merged).toHaveLength(2)
    expect(merged).toContainEqual([120, 120, 120])
    expect(merged).toContainEqual([220, 40, 40])
  })
})

describe('despeckle', () => {
  const B = '#0000ff'
  const R = '#ff0000'
  it('recolors a lone speckle to its surroundings', () => {
    const grid = [
      [B, B, B],
      [B, R, B],
      [B, B, B]
    ]
    expect(despeckle(grid)[1][1]).toBe(B)
  })
  it('keeps 1px lines and transparency intact', () => {
    const grid = [
      [B, B, B],
      [R, R, R], // 1px line: every cell has a same-color orthogonal neighbor
      ['', '', '']
    ]
    const out = despeckle(grid)
    expect(out[1]).toEqual([R, R, R])
    expect(out[2]).toEqual(['', '', ''])
  })
})

describe('crunchImageData', () => {
  it('turns the backdrop transparent and keeps real colors', () => {
    // 8x8: white backdrop, blue square with a green stripe
    const img: number[][] = []
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const inSubject = x >= 2 && x <= 5 && y >= 2 && y <= 5
        img.push(!inSubject ? [250, 250, 250, 255] : y === 3 ? [20, 200, 60, 255] : [30, 60, 220, 255])
      }
    }
    const grid = crunchImageData(rgba(img), 8, 8, 12)
    expect(grid[0][0]).toBe('') // backdrop gone
    expect(grid[3][3]).toMatch(/^#[0-9a-f]{6}$/)
    // the green stripe stays green-ish and distinct from the blue body
    const [, gr] = [1, 3].map((r) => parseInt(grid[r][3].slice(3, 5) || '0', 16))
    expect(grid[3][3]).not.toBe(grid[4][3])
    expect(gr).toBeGreaterThan(100)
  })

  it('respects existing transparency', () => {
    const img = Array.from({ length: 16 }, (_, i) => (i % 2 ? [255, 0, 0, 255] : [0, 0, 0, 0]))
    const grid = crunchImageData(rgba(img), 4, 4, 4)
    expect(grid[0][0]).toBe('')
    expect(grid[0][1]).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('emits palette-hex short enough for the sprite store (≤9 chars)', () => {
    const img = Array.from({ length: 16 }, (_, i) => [i * 15, 255 - i * 15, 128, 255])
    const grid = crunchImageData(rgba(img), 4, 4, 8)
    for (const row of grid) for (const c of row) expect(c.length).toBeLessThanOrEqual(9)
  })
})
