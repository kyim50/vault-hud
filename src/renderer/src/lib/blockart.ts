import { pandaColor, type PandaPalette } from './panda'

export interface Cell {
  ch: string
  fg: string | null // null = transparent (renders as panel background)
  bg: string | null
}

// Render a sprite matrix (char language B/D/n/E/L/.) as half-block terminal
// art: '▀' with fg = top pixel color, bg = bottom pixel color, pairing two
// sprite rows per glyph row so the ~1:2 monospace cell keeps correct aspect.
export function spriteToHalfBlocks(matrix: string[], palette: PandaPalette): Cell[][] {
  const width = matrix.reduce((w, r) => Math.max(w, r.length), 0)
  const rows: Cell[][] = []
  for (let y = 0; y < matrix.length; y += 2) {
    const top = matrix[y] ?? ''
    const bottom = matrix[y + 1] ?? ''
    const row: Cell[] = []
    for (let x = 0; x < width; x++) {
      row.push({
        ch: '▀',
        fg: pandaColor(top[x] ?? '.', palette, false),
        bg: pandaColor(bottom[x] ?? '.', palette, false)
      })
    }
    rows.push(row)
  }
  return rows
}
