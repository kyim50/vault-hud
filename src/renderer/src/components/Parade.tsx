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
  kind: 'buddy' | 'bird' | 'snail'
  x: number
  dir: 1 | -1
  speed: number
}

function h(x: number, y: number): number {
  let v = (x * 374761393 + y * 668265263) | 0
  v = (v ^ (v >> 13)) * 1274126177
  return ((v ^ (v >> 16)) >>> 0) / 4294967296
}

export function Parade() {
  const ref = useRef<HTMLCanvasElement>(null)
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
      const kind = roll < 0.5 ? 'buddy' : roll < 0.8 ? 'bird' : 'snail'
      const dir = h(frame, 7) < 0.5 ? 1 : -1
      walkers.push({
        kind,
        x: dir === 1 ? -20 : canvas.width + 20,
        dir: dir as 1 | -1,
        speed: kind === 'bird' ? 2.4 : kind === 'snail' ? 0.35 : 1.1
      })
    }

    const draw = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // every ~25-45s, someone strolls by (keep at most 2 on screen)
      if (walkers.length < 2 && frame % (300 + Math.floor(h(Math.floor(frame / 300), 3) * 240)) === 299) spawn()
      for (let i = walkers.length - 1; i >= 0; i--) {
        const w = walkers[i]
        w.x += w.dir * w.speed
        if (w.x < -30 || w.x > canvas.width + 30) {
          walkers.splice(i, 1)
          continue
        }
        const x = Math.round(w.x)
        if (w.kind === 'bird') {
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
