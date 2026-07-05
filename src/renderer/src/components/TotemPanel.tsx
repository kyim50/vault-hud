import { useEffect, useRef } from 'react'
import type { CustomSprite } from '@shared/types'
import { Panel } from './Panel'

// Your extracted sprite, displayed proudly at HUD scale — the point of the
// Sprite Studio. One totem at a time; drag the panel wherever you like.
export function TotemPanel({ sprite }: { sprite?: CustomSprite }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!sprite) return
    const canvas = ref.current!
    const grid = sprite.grid
    const gw = Math.max(...grid.map((r) => r.length))
    const gh = grid.length
    const scale = Math.max(2, Math.floor(132 / Math.max(gw, gh)))
    canvas.width = gw * scale
    canvas.height = gh * scale + scale // headroom for the bob
    canvas.style.width = `${canvas.width}px`
    canvas.style.height = `${canvas.height}px`
    const ctx = canvas.getContext('2d')!
    let f = 0
    const draw = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const bob = Math.floor(f / 4) % 2 ? scale : 0
      grid.forEach((row, y) =>
        row.forEach((col, x) => {
          if (!col) return
          ctx.fillStyle = col
          ctx.fillRect(x * scale, y * scale + bob, scale, scale)
        })
      )
      f++
    }
    draw()
    const t = setInterval(draw, 1000 / 8)
    return () => clearInterval(t)
  }, [sprite])

  return (
    <Panel title="Totem" corner={sprite ? sprite.name.toUpperCase() : 'EMPTY'}>
      {sprite ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <canvas ref={ref} style={{ imageRendering: 'pixelated' }} />
        </div>
      ) : (
        <div className="dim" style={{ fontSize: 10 }}>
          no totem yet — settings → sprite studio → save → totem
        </div>
      )}
    </Panel>
  )
}
