// Hand-drawn 3×5 bitmap font for canvas HUD text. Canvas fillText gets
// anti-aliased into mush on a pixel-art surface — this renders every glyph
// as literal pixels, crisp at the canvas's native resolution.

const G: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '010', '001'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '011'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  ' ': ['000', '000', '000', '000', '000'],
  '·': ['000', '000', '010', '000', '000'],
  '.': ['000', '000', '000', '000', '010'],
  '-': ['000', '000', '111', '000', '000'],
  '+': ['000', '010', '111', '010', '000'],
  "'": ['010', '010', '000', '000', '000'],
  '/': ['001', '001', '010', '100', '100'],
  ':': ['000', '010', '000', '010', '000'],
  '★': ['010', '111', '111', '101', '000']
}

export const GLYPH_W = 3
export const GLYPH_H = 5
const ADVANCE = GLYPH_W + 1

export function measurePixelText(text: string, scale = 1): number {
  return Math.max(0, text.length * ADVANCE - 1) * scale
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { color: string; scale?: number; align?: 'left' | 'center' | 'right' } = { color: '#e8e6e3' }
): void {
  const scale = opts.scale ?? 1
  const t = text.toUpperCase()
  const w = measurePixelText(t, scale)
  let ox = Math.round(opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x)
  const oy = Math.round(y)
  ctx.fillStyle = opts.color
  for (const ch of t) {
    const rows = G[ch] ?? G[' ']
    for (let r = 0; r < GLYPH_H; r++) {
      for (let c = 0; c < GLYPH_W; c++) {
        if (rows[r][c] === '1') ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale)
      }
    }
    ox += ADVANCE * scale
  }
}
