import { useEffect, useRef } from 'react'
import { PANDA_BUDDY, drawPanda, type PandaPalette } from '../lib/panda'

// Retro frame around the whole HUD: pixel corner brackets, edge ticks, a
// slow clay glint tracing the border, and (when enabled) tiny critters —
// panda buddies, birds, snails, and your custom sprites — patrolling the
// perimeter. Replaces the old top parade + bottom pet. Pure decoration:
// pointer-events none, chunky 12fps steps.
const CLAY = '#d97757'

const INSET = 10 // the frame line sits this far inside the window edge

interface Critter {
  kind: 'buddy' | 'bird' | 'snail' | 'custom'
  grid?: string[][]
  t: number // distance travelled along the perimeter loop
  dir: 1 | -1
  speed: number
}

function h(x: number, y: number): number {
  let v = (x * 374761393 + y * 668265263) | 0
  v = (v ^ (v >> 13)) * 1274126177
  return ((v ^ (v >> 16)) >>> 0) / 4294967296
}

// point + walking angle at distance t along the frame rectangle (clockwise
// from the top-left corner)
function alongPerimeter(t: number, w: number, h_: number): { x: number; y: number; a: number } {
  const iw = w - INSET * 2
  const ih = h_ - INSET * 2
  const loop = 2 * (iw + ih)
  let d = ((t % loop) + loop) % loop
  if (d < iw) return { x: INSET + d, y: INSET, a: 0 } // top, walking right
  d -= iw
  if (d < ih) return { x: w - INSET, y: INSET + d, a: Math.PI / 2 } // right, walking down
  d -= ih
  if (d < iw) return { x: w - INSET - d, y: h_ - INSET, a: Math.PI } // bottom, walking left
  d -= iw
  return { x: INSET, y: h_ - INSET - d, a: -Math.PI / 2 } // left, walking up
}

export function HudFrame({
  critters,
  sprites,
  theme
}: {
  critters: boolean
  sprites: { name: string; grid: string[][] }[]
  theme: 'terminal' | 'paper'
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const spritesRef = useRef(sprites)
  spritesRef.current = sprites
  const crittersRef = useRef(critters)
  crittersRef.current = critters

  useEffect(() => {
    const canvas = ref.current!
    const fit = (): void => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    fit()
    window.addEventListener('resize', fit)
    const ctx = canvas.getContext('2d')!

    // frame ink follows the active theme
    const css = getComputedStyle(document.body)
    const LINE = css.getPropertyValue('--line-soft').trim() || '#3a3a3a'
    const INK = css.getPropertyValue('--ink').trim() || '#e8e6e3'
    const DIM = css.getPropertyValue('--ink-dim').trim() || '#8f8f8f'
    const EYE = '#17160f'

    let frame = 0
    const walkers: Critter[] = []

    const spawn = (): void => {
      const roll = h(frame, 42)
      const hasCustom = spritesRef.current.length > 0
      const kind = hasCustom && roll < 0.3 ? 'custom' : roll < 0.55 ? 'buddy' : roll < 0.82 ? 'bird' : 'snail'
      const grid =
        kind === 'custom' ? spritesRef.current[Math.floor(h(frame, 11) * spritesRef.current.length)].grid : undefined
      walkers.push({
        kind,
        grid,
        t: h(frame, 5) * 2 * (canvas.width + canvas.height),
        dir: h(frame, 7) < 0.5 ? 1 : -1,
        speed: kind === 'bird' ? 2.4 : kind === 'snail' ? 0.35 : kind === 'custom' ? 0.9 : 1.1
      })
    }

    // sprite feet sit on the frame line, body hanging inward
    const drawCritter = (w: Critter): void => {
      const p = alongPerimeter(w.t, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.a + (w.dir === -1 ? Math.PI : 0))
      const step = Math.floor(frame / 3) % 2
      if (w.kind === 'custom' && w.grid) {
        const gh = w.grid.length
        const shrink = Math.max(1, Math.ceil(gh / 14))
        const rows = Math.ceil(gh / shrink)
        const bob = Math.floor(frame / 4) % 2
        for (let r = 0; r < gh; r += shrink) {
          for (let c = 0; c < w.grid[r].length; c += shrink) {
            const col = w.grid[r][c]
            if (!col) continue
            ctx.fillStyle = col
            ctx.fillRect(Math.floor(c / shrink) - 7, Math.floor(r / shrink) - rows + bob + 1, 1, 1)
          }
        }
      } else if (w.kind === 'bird') {
        const flap = Math.floor(frame / 3) % 2 === 0
        ctx.fillStyle = INK
        const y = -5 + Math.round(Math.sin(frame / 5) * 2)
        if (flap) {
          ctx.fillRect(-3, y - 2, 2, 1)
          ctx.fillRect(2, y - 2, 2, 1)
          ctx.fillRect(-1, y - 1, 3, 1)
        } else {
          ctx.fillRect(-4, y, 3, 1)
          ctx.fillRect(2, y, 3, 1)
          ctx.fillRect(-1, y - 1, 3, 1)
        }
      } else if (w.kind === 'snail') {
        ctx.fillStyle = INK
        ctx.fillRect(-2, -6, 4, 4)
        ctx.fillRect(-1, -5, 2, 2)
        ctx.fillStyle = DIM
        ctx.fillRect(-5, -3, 4, 2)
        ctx.fillRect(-6, -6, 1, 3)
      } else {
        const pal: PandaPalette = { body: CLAY, dark: '#b85c3f', ink: INK, eye: EYE, muzzle: '#e8a284' }
        drawPanda(ctx, PANDA_BUDDY, -PANDA_BUDDY[0].length, -PANDA_BUDDY.length * 2 + (step === 1 ? 1 : 0), 2, pal, {
          step: step as 0 | 1
        })
      }
      ctx.restore()
    }

    const draw = (): void => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // the frame line: solid hairline rectangle
      ctx.strokeStyle = LINE
      ctx.lineWidth = 1
      ctx.strokeRect(INSET + 0.5, INSET + 0.5, W - INSET * 2 - 1, H - INSET * 2 - 1)

      // chunky stepped corner brackets in ink
      ctx.fillStyle = INK
      const B = 3 // bracket pixel size
      const corners: [number, number, 1 | -1, 1 | -1][] = [
        [INSET, INSET, 1, 1],
        [W - INSET, INSET, -1, 1],
        [W - INSET, H - INSET, -1, -1],
        [INSET, H - INSET, 1, -1]
      ]
      for (const [cx, cy, sx, sy] of corners) {
        ctx.fillRect(cx - (sx < 0 ? B * 4 : 0), cy - (sy < 0 ? B : 0), B * 4, B)
        ctx.fillRect(cx - (sx < 0 ? B : 0), cy - (sy < 0 ? B * 4 : 0), B, B * 4)
        ctx.fillRect(cx + sx * B - (sx < 0 ? B * 2 : 0), cy + sy * B - (sy < 0 ? B * 2 : 0), B * 2, B * 2)
      }

      // tick marks marching along the edges
      ctx.fillStyle = LINE
      for (let x = INSET + 28; x < W - INSET - 20; x += 28) {
        ctx.fillRect(x, INSET - 2, 1, 2)
        ctx.fillRect(x, H - INSET + 1, 1, 2)
      }
      for (let y = INSET + 28; y < H - INSET - 20; y += 28) {
        ctx.fillRect(INSET - 2, y, 2, 1)
        ctx.fillRect(W - INSET + 1, y, 2, 1)
      }

      // midpoint diamonds
      ctx.fillStyle = DIM
      for (const [mx, my] of [
        [W / 2, INSET],
        [W / 2, H - INSET],
        [INSET, H / 2],
        [W - INSET, H / 2]
      ]) {
        ctx.fillRect(Math.round(mx) - 1, Math.round(my) - 3, 2, 2)
        ctx.fillRect(Math.round(mx) - 3, Math.round(my) - 1, 2, 2)
        ctx.fillRect(Math.round(mx) + 1, Math.round(my) - 1, 2, 2)
        ctx.fillRect(Math.round(mx) - 1, Math.round(my) + 1, 2, 2)
      }

      // a slow clay glint tracing the border, comet-style
      ctx.fillStyle = CLAY
      for (let k = 0; k < 4; k++) {
        const p = alongPerimeter(frame * 1.6 - k * 4, W, H)
        ctx.globalAlpha = 1 - k * 0.24
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2)
      }
      ctx.globalAlpha = 1

      // critters patrol the frame
      if (crittersRef.current) {
        if (walkers.length < 3 && frame % (120 + Math.floor(h(Math.floor(frame / 120), 3) * 150)) === 119) spawn()
        if (frame === 30) spawn() // someone shows up soon after launch
        const loop = 2 * (W - INSET * 2) + 2 * (H - INSET * 2)
        for (let i = walkers.length - 1; i >= 0; i--) {
          const w = walkers[i]
          w.t += w.dir * w.speed
          // everyone eventually wanders off after a full-ish lap
          if (Math.abs(w.t) > loop * 3) {
            walkers.splice(i, 1)
            continue
          }
          drawCritter(w)
        }
      } else if (walkers.length) {
        walkers.length = 0
      }
      frame++
    }

    draw()
    const timer = setInterval(draw, 1000 / 12)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', fit)
    }
  }, [theme])

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
        imageRendering: 'pixelated'
      }}
    />
  )
}
