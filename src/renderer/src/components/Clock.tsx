import { useEffect, useState } from 'react'

export function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return (
    <div style={{ textAlign: 'right' }}>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 18 }} className="accent">{hh}:{mm}</span>
      <span className="dim" style={{ fontFamily: 'var(--font-pixel)', fontSize: 10 }}>:{ss}</span>
      <div className="dim" style={{ fontSize: 10 }}>
        {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
      </div>
    </div>
  )
}
