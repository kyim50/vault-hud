import { useEffect, useRef } from 'react'

// Tiny critters that occasionally walk/fly across the very top of the
// window. Pure decoration: pointer-events none, chunky 12fps steps.
const BODY = '#d97757'
const DARK = '#b85c3f'
const EYE = '#17160f'
const INK = '#e8e6e3'

const BUDDY = [
  '.BBBBBB.',
  'BBBBBBBB',
  'BEBBBBEB',
  'BBBBBBBB',
  '.L.LL.L.'
]

interface Walker {
  kind: 'buddy' | 'bird' | 'snail' | 'custom'
  grid?: string[][]
  x: number
  dir: 1 | -1
  speed: number
}

function h(x: number, y: number): number {
  let v = (x * 374761393 + y * 668265263) | 0
  v = (v ^ (v >> 13)) * 1274126177
  return ((v ^ (v >> 16)) >>> 0) / 4294967296
}

export function Parade({ enabled, sprites }: { enabled: boolean; sprites: { name: string; grid: string[][] }[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const spritesRef = useRef(sprites)
  spritesRef.current = sprites
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  useEffect(() => {
    const canvas = ref.current!
    const fit = (): void => {
      canvas.width = canvas.clientWidth
      canvas.height = 16
    }
    fit()
    window.addEventListener('resize', fit)
    const ctx = canvas.getContext('2d')!
    let frame = 0
    const walkers: Walker[] = []

    const spawn = (): void => {
      const roll = h(frame, 42)
      const hasCustom = spritesRef.current.length > 0
      const kind = hasCustom && roll < 0.3 ? 'custom' : roll < 0.55 ? 'buddy' : roll < 0.82 ? 'bird' : 'snail'
      const dir = h(frame, 7) < 0.5 ? 1 : -1
      const grid = kind === 'custom' ? spritesRef.current[Math.floor(h(frame, 11) * spritesRef.current.length)].grid : undefined
      const startX = dir === 1 ? -30 : canvas.width + 30
      walkers.push({
        kind,
        grid,
        x: startX,
        dir: dir as 1 | -1,
        speed: kind === 'bird' ? 2.4 : kind === 'snail' ? 0.35 : kind === 'custom' ? 0.9 : 1.1
      })
      // birds often travel in small flocks
      if (kind === 'bird') {
        const extra = h(frame, 13) < 0.6 ? 1 + Math.floor(h(frame, 17) * 2) : 0
        for (let k = 1; k <= extra; k++) {
          walkers.push({ kind: 'bird', x: startX - dir * (14 + k * 12), dir: dir as 1 | -1, speed: 2.4 })
        }
      }
    }

    const draw = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!enabledRef.current) {
        frame++
        return
      }
      // every ~10-22s someone strolls or flies by (up to 3 on screen)
      if (walkers.length < 3 && frame % (120 + Math.floor(h(Math.floor(frame / 120), 3) * 150)) === 119) spawn()
      if (frame === 30) spawn() // someone shows up soon after launch
      for (let i = walkers.length - 1; i >= 0; i--) {
        const w = walkers[i]
        w.x += w.dir * w.speed
        if (w.x < -30 || w.x > canvas.width + 30) {
          walkers.splice(i, 1)
          continue
        }
        const x = Math.round(w.x)
        if (w.kind === 'custom' && w.grid) {
          // shrink custom sprites to fit the strip (max 14px tall)
          const gh = w.grid.length
          const step = Math.max(1, Math.ceil(gh / 14))
          const bob = Math.floor(frame / 4) % 2
          for (let r = 0; r < gh; r += step) {
            for (let c = 0; c < w.grid[r].length; c += step) {
              const col = w.grid[r][c]
              if (!col) continue
              ctx.fillStyle = col
              ctx.fillRect(x + Math.floor(c / step), 1 + bob + Math.floor(r / step), 1, 1)
            }
          }
        } else if (w.kind === 'bird') {
          const flap = Math.floor(frame / 3) % 2 === 0
          ctx.fillStyle = INK
          const y = 7 + Math.round(Math.sin(frame / 5) * 2)
          if (flap) {
            ctx.fillRect(x - 3, y - 2, 2, 1)
            ctx.fillRect(x + 2, y - 2, 2, 1)
            ctx.fillRect(x - 1, y - 1, 3, 1)
          } else {
            ctx.fillRect(x - 4, y, 3, 1)
            ctx.fillRect(x + 2, y, 3, 1)
            ctx.fillRect(x - 1, y - 1, 3, 1)
          }
        } else if (w.kind === 'snail') {
          ctx.fillStyle = INK
          // shell spiral
          ctx.fillRect(x, 8, 4, 4)
          ctx.fillRect(x + 1, 9, 2, 2)
          ctx.fillStyle = DARK
          ctx.fillRect(x - 3 * w.dir, 11, 4, 2) // body
          ctx.fillRect(x - 4 * w.dir, 8, 1, 3) // eye stalk
        } else {
          const step = Math.floor(frame / 3) % 2
          for (let r = 0; r < BUDDY.length; r++) {
            for (let c = 0; c < BUDDY[r].length; c++) {
              const ch = BUDDY[r][c]
              if (ch === '.') continue
              if (ch === 'L' && ((step === 1 && c < 4) || (step === 0 && c >= 4))) continue
              ctx.fillStyle = ch === 'E' ? EYE : BODY
              ctx.fillRect(x + c * 2, 3 + r * 2 + (step === 1 ? 1 : 0), 2, 2)
            }
          }
        }
      }
      frame++
    }
    draw()
    const timer = setInterval(draw, 1000 / 12)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', fit)
    }
  }, [])
  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: 16,
        pointerEvents: 'none',
        zIndex: 10,
        imageRendering: 'pixelated'
      }}
    />
  )
}
