import { useEffect, useRef } from 'react'

// Claude FM-style scene: halftone-dot clouds and ground, one clay pixel
// critter. Everything ink-on-cream except the mascot itself.
const W = 192
const H = 108
const INK = '#17160f'
const BODY = '#d97757'
const DARK = '#b85c3f'
const EYE = '#17160f'

// 22x14 sprite: B body, D shaded edge, E eye, n top nub, L leg, . empty
const SPRITE = [
  '..nn..............nn..',
  '..nnBBBBBBBBBBBBBBnn..',
  '..BBBBBBBBBBBBBBBBDD..',
  '.BBBBBBBBBBBBBBBBBBDD.',
  '.BBEEBBBBBBBBBBEEBBDD.',
  '.BBEEBBBBBBBBBBEEBBDD.',
  '.BBBBBBBBBBBBBBBBBBDD.',
  '.BBBBBBBBBBBBBBBBBBDD.',
  '.BBBBBBBBBBBBBBBBBBDD.',
  '..BBBBBBBBBBBBBBBBDD..',
  '..BBBBBBBBBBBBBBBBDD..',
  '...BBBBBBBBBBBBBBDD...',
  '...LL..LL....LL..LL...',
  '...LL..LL....LL..LL...'
]
const CELL = 3 // sprite cell size in scene px

// deterministic hash → [0,1) so the dot field is stable across frames
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967296
}

function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = -ry; y <= ry; y += 2) {
    for (let x = -rx; x <= rx; x += 2) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry)
      if (d > 1) continue
      // denser toward the middle, ragged at the edge
      if (hash(Math.round(cx + x), Math.round(cy + y)) < 0.85 - d * 0.75) {
        ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1)
      }
    }
  }
}

export function Mascot({ usagePercent }: { usagePercent: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let frame = 0
    const blinkEvery = usagePercent > 80 ? 24 : 48 // busier window, twitchier critter

    const draw = (): void => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = INK

      // drifting dot clouds (wrap around)
      const drift = (frame * 0.4) % (W + 120)
      drawCloud(ctx, ((36 + drift) % (W + 120)) - 60, 22, 34, 11)
      drawCloud(ctx, ((150 + drift * 0.6) % (W + 120)) - 60, 38, 24, 8)

      // halftone ground: airy dotted field, gently denser toward the bottom
      const horizon = 88
      for (let y = horizon; y < H; y += 2) {
        const t = (y - horizon) / (H - horizon)
        const density = 0.08 + t * 0.35
        for (let x = 0; x < W; x += 2) {
          if (hash(x, y) < density) ctx.fillRect(x, y, 1, 1)
        }
      }

      // mascot: bob 1 cell every 6 frames, blink for 6 frames on the interval
      const bob = Math.floor(frame / 6) % 2
      const blinking = frame % blinkEvery >= blinkEvery - 6
      const sx = Math.round(W / 2 - (SPRITE[0].length * CELL) / 2)
      const sy = horizon - SPRITE.length * CELL + 2 + bob
      for (let r = 0; r < SPRITE.length; r++) {
        for (let c = 0; c < SPRITE[r].length; c++) {
          const ch = SPRITE[r][c]
          if (ch === '.') continue
          // legs tuck alternately with the bob for a tiny shuffle
          if (ch === 'L' && r === SPRITE.length - 1 && bob === 1 && c < 11) continue
          if (ch === 'L' && r === SPRITE.length - 1 && bob === 0 && c >= 11) continue
          ctx.fillStyle =
            ch === 'E' ? (blinking ? BODY : EYE)
            : ch === 'D' ? DARK
            : ch === 'n' ? DARK
            : BODY
          ctx.fillRect(sx + c * CELL, sy + r * CELL, CELL, CELL)
        }
      }
      frame++
    }
    draw()
    const timer = setInterval(draw, 1000 / 12) // deliberate 12fps step animation
    return () => clearInterval(timer)
  }, [usagePercent])
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <canvas
        ref={ref}
        width={W}
        height={H}
        style={{ width: '100%', maxWidth: 560, imageRendering: 'pixelated', aspectRatio: '16/9' }}
      />
    </div>
  )
}
