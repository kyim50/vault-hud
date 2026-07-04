import { useEffect, useRef } from 'react'

// Free-roaming desk pet: wanders, sprints, hops, and naps along the bottom
// edge of the window (VSCode Pets style). Dances while a command runs.
// Click it (window-level hit test — the canvas never blocks the UI) for
// hearts. XP comes from checked-off directives.
const BODY = '#d97757'
const DARK = '#b85c3f'
const EYE = '#17160f'
const INK = '#e8e6e3'

const PET = [
  '.BBBBBB.',
  'BBBBBBBB',
  'BEBBBBEB',
  'BBBBBBBB',
  'BBBBBBBB',
  '.L.LL.L.'
]

type Mode = 'walk' | 'run' | 'idle' | 'sleep' | 'jump'

const STRIP_H = 40

export function RoamingPet({ name, xp, busy, skin }: { name: string; xp: number; busy: boolean; skin?: string[][] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const skinRef = useRef(skin)
  skinRef.current = skin
  const petX = useRef(120)
  const hearts = useRef(0)
  const level = Math.floor(xp / 5) + 1

  useEffect(() => {
    const canvas = ref.current!
    const fit = (): void => {
      canvas.width = canvas.clientWidth
      canvas.height = STRIP_H
    }
    fit()
    window.addEventListener('resize', fit)
    const ctx = canvas.getContext('2d')!

    let f = 0
    let mode: Mode = 'walk'
    let modeLeft = 60
    let dir: 1 | -1 = 1
    let jumpT = -1

    const pickMode = (): void => {
      const r = Math.random()
      if (r < 0.34) { mode = 'walk'; modeLeft = 50 + Math.random() * 90 }
      else if (r < 0.52) { mode = 'run'; modeLeft = 25 + Math.random() * 40 }
      else if (r < 0.68) { mode = 'idle'; modeLeft = 30 + Math.random() * 50 }
      else if (r < 0.82) { mode = 'sleep'; modeLeft = 90 + Math.random() * 120 }
      else { mode = 'jump'; modeLeft = 26; jumpT = 0 }
      if (Math.random() < 0.4) dir = dir === 1 ? -1 : 1
    }

    const onClick = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect()
      if (e.clientY >= rect.top && Math.abs(e.clientX - petX.current - 10) < 26) {
        hearts.current = 24
        if (mode === 'sleep') { mode = 'jump'; modeLeft = 26; jumpT = 0 } // wake with a startle
      }
    }
    window.addEventListener('click', onClick)

    const draw = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const dancing = busyRef.current

      if (!dancing) {
        if (--modeLeft <= 0) pickMode()
      }
      const speed = dancing ? 0 : mode === 'run' ? 2.4 : mode === 'walk' ? 0.8 : mode === 'jump' ? 1.4 : 0
      petX.current += dir * speed
      if (petX.current < 8) { petX.current = 8; dir = 1 }
      if (petX.current > canvas.width - 34) { petX.current = canvas.width - 34; dir = -1 }

      let hop = 0
      if (mode === 'jump' && jumpT >= 0) {
        jumpT += 1
        const t = jumpT / 13
        hop = Math.round(-14 * Math.sin(Math.min(1, t) * Math.PI))
        if (jumpT > 13) jumpT = -1
      }
      if (dancing) hop = Math.floor(f / 2) % 2 === 0 ? -4 : 0

      const asleep = !dancing && mode === 'sleep'
      const moving = speed > 0
      const step = Math.floor(f / (mode === 'run' ? 2 : 3)) % 2
      const x = Math.round(petX.current)
      const baseY = STRIP_H - 14 + hop + (dancing ? 0 : moving ? (step ? 1 : 0) : 0)

      const sk = skinRef.current
      if (sk) {
        const shrink = Math.max(1, Math.ceil(sk.length / 22))
        for (let r = 0; r < sk.length; r += shrink) {
          for (let c = 0; c < sk[r].length; c += shrink) {
            const col = sk[r][c]
            if (!col) continue
            ctx.fillStyle = col
            ctx.fillRect(x + Math.floor(c / shrink), STRIP_H - 24 + hop + Math.floor(r / shrink), 1, 1)
          }
        }
      } else {
        for (let r = 0; r < PET.length; r++) {
          for (let c = 0; c < PET[r].length; c++) {
            const ch = PET[r][c]
            if (ch === '.') continue
            if (ch === 'L' && moving && ((step === 1 && c < 4) || (step === 0 && c >= 4))) continue
            if (ch === 'L' && asleep) continue
            ctx.fillStyle = ch === 'E' ? (asleep || f % 48 >= 44 ? BODY : EYE) : c >= 6 && r < 3 ? DARK : BODY
            ctx.fillRect(x + c * 2, baseY + r * 2 - (asleep ? 3 : 0), 2, asleep && r >= 4 ? 1 : 2)
          }
        }
      }

      // name · lv tag floats above
      ctx.font = '5px "Press Start 2P", monospace'
      ctx.fillStyle = '#8f8f8f'
      ctx.fillText(`${name} lv${level}`, x - 2, baseY - 6 + (asleep ? 3 : 0))

      if (asleep) {
        ctx.fillStyle = INK
        const z = Math.floor(f / 8) % 3
        ctx.fillRect(x + 18 + z * 3, baseY - 10 - z * 3, 2, 1)
        ctx.fillRect(x + 19 + z * 3, baseY - 9 - z * 3, 1, 1)
        ctx.fillRect(x + 18 + z * 3, baseY - 8 - z * 3, 2, 1)
      }
      if (hearts.current > 0) {
        hearts.current -= 1
        ctx.fillStyle = BODY
        for (let i = 0; i < 3; i++) {
          const hy = baseY - 10 - ((24 - hearts.current) + i * 5) % 18
          const hx = x + 2 + i * 8 + Math.round(Math.sin((f + i * 4) / 3) * 2)
          ctx.fillRect(hx, hy, 1, 1)
          ctx.fillRect(hx + 2, hy, 1, 1)
          ctx.fillRect(hx, hy + 1, 3, 1)
          ctx.fillRect(hx + 1, hy + 2, 1, 1)
        }
      }
      f++
    }
    draw()
    const timer = setInterval(draw, 1000 / 12)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', fit)
      window.removeEventListener('click', onClick)
    }
  }, [name, level])

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed',
        left: 0,
        bottom: 2,
        width: '100%',
        height: STRIP_H,
        pointerEvents: 'none',
        zIndex: 9,
        imageRendering: 'pixelated'
      }}
    />
  )
}
