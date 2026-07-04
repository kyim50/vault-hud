import { useEffect, useRef, useState } from 'react'

// Desk pet in the corner: sleeps when things are quiet, dances while a
// command runs, throws hearts when you pet it. XP comes from checked-off
// directives (persisted in config by the main process).
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

export function PetBox({ name, xp, busy, skin }: { name: string; xp: number; busy: boolean; skin?: string[][] }) {
  const skinRef = useRef(skin)
  skinRef.current = skin
  const ref = useRef<HTMLCanvasElement>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const [hearts, setHearts] = useState(0)
  const heartsRef = useRef(0)
  heartsRef.current = hearts
  const level = Math.floor(xp / 5) + 1

  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!
    let f = 0
    const draw = (): void => {
      ctx.clearRect(0, 0, 64, 40)
      // dotted floor
      ctx.fillStyle = INK
      for (let x = 4; x < 60; x += 3) {
        if ((x * 13) % 7 > 2) ctx.fillRect(x, 36, 1, 1)
      }
      const dancing = busyRef.current
      // idle pets nap in cycles: ~14s awake, ~8s asleep
      const cycle = f % 264
      const asleep = !dancing && cycle > 168
      const bounce = dancing ? (Math.floor(f / 2) % 2 === 0 ? -3 : 0) : (Math.floor(f / 8) % 2)
      const px = 24 + (dancing ? Math.round(Math.sin(f / 3) * 4) : 0)
      const py = (asleep ? 24 : 21) + bounce
      const sk = skinRef.current
      if (sk) {
        // custom skin: draw scaled to ~24px wide, bobbing
        const step = Math.max(1, Math.ceil(sk.length / 26))
        for (let r = 0; r < sk.length; r += step) {
          for (let c = 0; c < sk[r].length; c += step) {
            const col = sk[r][c]
            if (!col) continue
            ctx.fillStyle = col
            ctx.fillRect(20 + Math.floor(c / step), 8 + bounce + Math.floor(r / step), 1, 1)
          }
        }
        f++
        return
      }
      for (let r = 0; r < PET.length; r++) {
        for (let c = 0; c < PET[r].length; c++) {
          const ch = PET[r][c]
          if (ch === '.') continue
          if (asleep && r > 3 && ch === 'L') continue
          ctx.fillStyle = ch === 'E' ? (asleep || f % 48 >= 44 ? BODY : EYE) : BODY
          if (ch === 'B' && c >= 6 && r < 3) ctx.fillStyle = DARK
          ctx.fillRect(px + c * 2, py + r * 2 - (asleep ? 4 : 0), 2, asleep && r >= 4 ? 1 : 2)
        }
      }
      ctx.fillStyle = INK
      if (asleep) {
        // drifting Zs
        const z = Math.floor(f / 8) % 3
        ctx.fillRect(px + 20 + z * 2, py - 6 - z * 3, 2, 1)
        ctx.fillRect(px + 21 + z * 2, py - 5 - z * 3, 1, 1)
        ctx.fillRect(px + 20 + z * 2, py - 4 - z * 3, 2, 1)
      }
      if (heartsRef.current > 0 && f % 2 === 0) {
        // heart burst
        ctx.fillStyle = BODY
        for (let i = 0; i < 3; i++) {
          const hy = py - 8 - ((f * 2 + i * 5) % 14)
          const hx = px + 4 + i * 8 + Math.round(Math.sin((f + i * 4) / 3) * 2)
          ctx.fillRect(hx, hy, 1, 1)
          ctx.fillRect(hx + 2, hy, 1, 1)
          ctx.fillRect(hx, hy + 1, 3, 1)
          ctx.fillRect(hx + 1, hy + 2, 1, 1)
        }
      }
      f++
    }
    draw()
    const t = setInterval(draw, 1000 / 12)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (hearts === 0) return
    const t = setTimeout(() => setHearts(0), 2000)
    return () => clearTimeout(t)
  }, [hearts])

  return (
    <div
      onClick={() => setHearts((h) => h + 1)}
      title={`${name} · lv ${level} · ${xp} xp — pet them`}
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        width: 132,
        zIndex: 9,
        cursor: 'pointer',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        boxShadow: '2px 2px 0 0 var(--line)',
        padding: '4px 8px 6px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: 6, letterSpacing: 1 }}>
        <span>{name.toUpperCase()}</span>
        <span className="dim">LV {level}</span>
      </div>
      <canvas ref={ref} width={64} height={40} style={{ width: '100%', imageRendering: 'pixelated' }} />
      <div style={{ height: 3, background: 'var(--line-soft)' }}>
        <div style={{ height: '100%', width: `${(xp % 5) * 20}%`, background: 'var(--clay)' }} />
      </div>
    </div>
  )
}
