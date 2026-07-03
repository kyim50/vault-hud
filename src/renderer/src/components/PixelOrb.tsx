import { useEffect, useRef } from 'react'

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
]
const SIZE = 96

// palette: deep bg → dim green → accent green → cream highlight
const PALETTE = ['#0a0c08', '#22331a', '#5d8f2e', '#b6ff5e', '#e8e6d8']

export function PixelOrb({ usagePercent }: { usagePercent: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let frame = 0
    const draw = (): void => {
      const t = frame / 12
      const lightX = Math.cos(t * 0.7) * 0.8
      const lightY = Math.sin(t * 0.5) * 0.6
      const pulse = 1 + Math.sin(t * (1 + usagePercent / 50)) * 0.03
      const img = ctx.createImageData(SIZE, SIZE)
      const r = (SIZE / 2 - 6) * pulse
      const cx = SIZE / 2
      const cy = SIZE / 2
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const dx = (x - cx) / r
          const dy = (y - cy) / r
          const d2 = dx * dx + dy * dy
          let level = 0
          if (d2 <= 1) {
            const z = Math.sqrt(1 - d2)
            // lambert shading toward orbiting light
            const lum = Math.max(0, dx * lightX + dy * lightY + z * 0.9)
            const threshold = (BAYER[y % 4][x % 4] + 0.5) / 16
            const shade = lum * (PALETTE.length - 1)
            level = Math.min(PALETTE.length - 1, Math.floor(shade) + (shade % 1 > threshold ? 1 : 0))
            level = Math.max(1, level) // sphere body never fully bg
          }
          const hex = PALETTE[level]
          const i = (y * SIZE + x) * 4
          img.data[i] = parseInt(hex.slice(1, 3), 16)
          img.data[i + 1] = parseInt(hex.slice(3, 5), 16)
          img.data[i + 2] = parseInt(hex.slice(5, 7), 16)
          img.data[i + 3] = level === 0 ? 0 : 255
        }
      }
      ctx.putImageData(img, 0, 0)
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
        width={SIZE}
        height={SIZE}
        style={{ width: 'min(38vh, 90%)', imageRendering: 'pixelated', aspectRatio: '1' }}
      />
    </div>
  )
}
