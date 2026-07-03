import { useEffect, useRef, useState } from 'react'

export function PrimaryDirective({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const [shown, setShown] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    const dur = 900
    let raf: number
    const tick = (t: number): void => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setShown(Math.round(from + (value - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="dim" style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, letterSpacing: 1 }}>
        PRIMARY DIRECTIVE · {label}
      </div>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 42, color: 'var(--ink)', margin: '6px 0 2px' }}>
        {shown.toLocaleString()}
      </div>
      <div className="dim" style={{ fontSize: 11 }}>
        TARGET {target.toLocaleString()} {unit} · {Math.min(100, Math.round((value / Math.max(1, target)) * 100))}%
      </div>
      <div style={{ height: 4, background: 'var(--line)', marginTop: 8 }}>
        <div
          style={{
            height: '100%',
            background: 'var(--accent)',
            transform: `scaleX(${Math.min(1, value / Math.max(1, target))})`,
            transformOrigin: 'left',
            transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        />
      </div>
    </div>
  )
}
