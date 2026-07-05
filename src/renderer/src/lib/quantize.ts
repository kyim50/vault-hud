// Pixel-art crunching for the Sprite Studio: instead of forcing every image
// into the app's 5 fixed inks, extract the image's OWN palette (median-cut)
// so sprites keep their colors, and strip flat photo backgrounds so the
// subject floats on transparency like proper pixel art.

export type RGB = [number, number, number]

// perceptual-ish weighted distance² — green matters most to the eye
function dist2(ar: number, ag: number, ab: number, br: number, bg: number, bb: number): number {
  const dr = ar - br
  const dg = ag - bg
  const db = ab - bb
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db
}

// classic median-cut: split the box with the widest channel range at its
// median until we have maxColors boxes, then average each box
export function medianCut(pixels: RGB[], maxColors: number): RGB[] {
  if (pixels.length === 0) return []
  let boxes: RGB[][] = [pixels.slice()]
  while (boxes.length < maxColors) {
    let boxAt = -1
    let channel = 0
    let widest = 7 // ignore ranges too narrow to matter
    boxes.forEach((box, i) => {
      if (box.length < 2) return
      for (let c = 0; c < 3; c++) {
        let mn = 255
        let mx = 0
        for (const p of box) {
          if (p[c] < mn) mn = p[c]
          if (p[c] > mx) mx = p[c]
        }
        if (mx - mn > widest) {
          widest = mx - mn
          boxAt = i
          channel = c
        }
      }
    })
    if (boxAt < 0) break // every box is a flat color already
    const box = boxes[boxAt]
    box.sort((a, b) => a[channel] - b[channel])
    const mid = box.length >> 1
    boxes.splice(boxAt, 1, box.slice(0, mid), box.slice(mid))
  }
  return boxes.map((box) => {
    let r = 0
    let g = 0
    let b = 0
    for (const p of box) {
      r += p[0]
      g += p[1]
      b += p[2]
    }
    const n = box.length
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)] as RGB
  })
}

// Photos come in with a flat backdrop glued on. Detect it (most border
// pixels agree on a color) and flood-fill from the border so only the
// CONNECTED backdrop turns transparent — same-colored pixels inside the
// subject survive.
export function backgroundMask(data: Uint8ClampedArray, w: number, h: number): boolean[] {
  const mask = new Array<boolean>(w * h).fill(false)
  const border: number[] = []
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x)
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1)
  const opaque = border.filter((i) => data[i * 4 + 3] >= 100)
  // already transparent around the edges → trust the alpha channel instead
  if (opaque.length < border.length * 0.5) return mask
  const median = ([0, 1, 2] as const).map((c) => {
    const vals = opaque.map((i) => data[i * 4 + c]).sort((a, b) => a - b)
    return vals[vals.length >> 1]
  })
  const TOL = 4000
  const near = (i: number): boolean =>
    dist2(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], median[0], median[1], median[2]) < TOL
  const seeds = opaque.filter(near)
  // border is too varied to be a backdrop (busy photo) — keep everything
  if (seeds.length < border.length * 0.55) return mask
  const stack = seeds.slice()
  for (const i of seeds) mask[i] = true
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    const y = (i - x) / w
    for (const ni of [i - 1, i + 1, i - w, i + w]) {
      if (ni < 0 || ni >= w * h) continue
      if ((ni === i - 1 && x === 0) || (ni === i + 1 && x === w - 1)) continue
      if (!mask[ni] && near(ni)) {
        mask[ni] = true
        stack.push(ni)
      }
    }
  }
  return mask
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
]

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v)
const hex = (c: RGB): string => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')

// flat pixel art wants few, well-separated inks: collapse palette entries
// that are near-twins (two almost-identical grays read as noise, not shade)
export function mergePalette(palette: RGB[], minDist2 = 1800): RGB[] {
  const out: RGB[] = []
  for (const c of palette) {
    if (out.some((o) => dist2(c[0], c[1], c[2], o[0], o[1], o[2]) < minDist2)) continue
    out.push(c)
  }
  return out
}

// kill lone speckles: a pixel with NO orthogonal same-color neighbor adopts
// the most common neighboring color. 1px lines keep a same-color neighbor
// along their length, so real features survive. Transparency never changes.
export function despeckle(grid: string[][]): string[][] {
  const h = grid.length
  return grid.map((row, y) =>
    row.map((col, x) => {
      if (!col) return col
      const at = (yy: number, xx: number): string =>
        yy >= 0 && yy < h && xx >= 0 && xx < grid[yy].length ? grid[yy][xx] : ''
      if (at(y - 1, x) === col || at(y + 1, x) === col || at(y, x - 1) === col || at(y, x + 1) === col) return col
      const counts = new Map<string, number>()
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dy && !dx) continue
          const n = at(y + dy, x + dx)
          if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
        }
      }
      let best = col
      let bestN = 2 // need at least 3 agreeing neighbors to overrule
      for (const [c, n] of counts) {
        if (n > bestN) {
          bestN = n
          best = c
        }
      }
      return best
    })
  )
}

// RGBA image data → hex-color grid ('' = transparent): strip the backdrop,
// build a small merged palette from what's left, map pixels with only a
// whisper of dithering, then despeckle — flat, poster-like pixel art
export function crunchImageData(data: Uint8ClampedArray, w: number, h: number, maxColors = 10): string[][] {
  const bg = backgroundMask(data, w, h)
  const pixels: RGB[] = []
  for (let i = 0; i < w * h; i++) {
    if (!bg[i] && data[i * 4 + 3] >= 100) pixels.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]])
  }
  const palette = mergePalette(medianCut(pixels, maxColors))
  const grid: string[][] = []
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (bg[i] || data[i * 4 + 3] < 100 || palette.length === 0) {
        row.push('')
        continue
      }
      const n = (BAYER[y % 4][x % 4] / 15 - 0.5) * 8
      const r = clamp(data[i * 4] + n)
      const g = clamp(data[i * 4 + 1] + n)
      const b = clamp(data[i * 4 + 2] + n)
      let best = palette[0]
      let bestD = Infinity
      for (const p of palette) {
        const d = dist2(r, g, b, p[0], p[1], p[2])
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      row.push(hex(best))
    }
    grid.push(row)
  }
  return despeckle(grid)
}
