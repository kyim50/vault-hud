// The mascot: a simple clay "blob" sprite with pointy ears — deliberately
// minimal (solid body, two dot-eyes) so it reads as its own small creature,
// not Anthropic's mascot. Shared by the Core scenes, the HUD frame critters,
// and the notch island.
//
// Char language: B body(clay) · D dark clay edge / ears · n ear · E eye
// (blinks) · L stubby leg · . transparent

export const PANDA = [
  '.....n..............n.....',
  '....nnn............nnn....',
  '...BBBBBBBBBBBBBBBBBBBB...',
  '..BBBBBBBBBBBBBBBBBBBBDD..',
  '..BBBEEBBBBBBBBBBEEBBBDD..',
  '..BBBEEBBBBBBBBBBEEBBBDD..',
  '..BBBBBBBBBBBBBBBBBBBBDD..',
  '..BBBBBBBBBBBBBBBBBBBBDD..',
  '..BBBBBBBBBBBBBBBBBBBBDD..',
  '...BBBBBBBBBBBBBBBBBBDD...',
  '...BBBBBBBBBBBBBBBBBBDD...',
  '....BBBBBBBBBBBBBBBBDD....',
  '.....LL..LL....LL..LL.....',
  '.....LL..LL....LL..LL.....'
]
export const PANDA_W = 26
// body rows only (legs trimmed) — for sitting/surfing poses
export const PANDA_BODY_ROWS = 12

export const PANDA_BUDDY = [
  '..n......n..',
  '.nnn....nnn.',
  '.BBBBBBBBBB.',
  'BBEBBBBBEBBB',
  '.BBBBBBBBBB.',
  '.L.LL..LL.L.'
]
export const PANDA_BUDDY_W = 12

// notch-scale mini (head-and-shoulders with ears + tail hint)
export const PANDA_MINI = [
  '...n......n...',
  '..nnn....nnn..',
  '..BBBBBBBBBB..',
  '.BBBBBBBBBBBB.',
  '.BBEEBBBBEEBB.',
  '.BBEEBBBBEEBB.',
  '.BBBBBBBBBBBB.',
  '..BBBBBBBBBB..',
  '..L.LL..LL.L..'
]
export const PANDA_MINI_W = 14

export interface PandaPalette {
  body: string
  dark: string
  ink: string
  eye: string
  muzzle: string
}

export const DEFAULT_PALETTE: PandaPalette = {
  body: '#d97757',
  dark: '#b85c3f',
  ink: '#e8e6e3',
  eye: '#17160f',
  muzzle: '#f4f2e9' // red pandas wear cream face markings
}

export function pandaColor(ch: string, pal: PandaPalette, blink: boolean): string | null {
  switch (ch) {
    case 'B':
      return pal.body
    case 'D':
    case 'n':
      return pal.dark
    case 'E':
      return blink ? pal.body : pal.eye
    case 'o': // nose — dark, never blinks
      return pal.eye
    case 'M':
      return pal.muzzle
    case 'I':
      return pal.ink
    case 'L':
      return pal.dark
    default:
      return null
  }
}

// generic matrix draw with an optional 2-frame leg gait: on step 0/1 the
// alternating leg pairs lift, reading as a stubby-legged waddle
export function drawPanda(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  sx: number,
  sy: number,
  cell: number,
  pal: PandaPalette,
  opts: { blink?: boolean; step?: 0 | 1 } = {}
): void {
  const legRowStart = rows.findIndex((r) => r.includes('L'))
  for (let r = 0; r < rows.length; r++) {
    // count which leg group each L column belongs to so pairs alternate
    let legGroup = -1
    let prevWasLeg = false
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c]
      if (ch === 'L') {
        if (!prevWasLeg) legGroup++
        prevWasLeg = true
      } else {
        prevWasLeg = false
      }
      if (ch === '.') continue
      if (opts.step !== undefined && ch === 'L' && legRowStart >= 0 && r === rows.length - 1) {
        // lift alternating leg groups on the last row for the gait
        if (legGroup % 2 === opts.step) continue
      }
      const col = pandaColor(ch, pal, opts.blink ?? false)
      if (!col) continue
      ctx.fillStyle = col
      ctx.fillRect(sx + c * cell, sy + r * cell, cell, cell)
    }
  }
}
