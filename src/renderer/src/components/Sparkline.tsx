export function Sparkline({ data, width = 84 }: { data: number[]; width?: number }) {
  const max = Math.max(1, ...data)
  const barW = Math.floor(width / data.length) - 2
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 18 }} aria-hidden>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            width: barW,
            height: Math.max(2, Math.round((v / max) * 18)),
            background: i === data.length - 1 ? 'var(--accent)' : 'var(--accent-dim)'
          }}
        />
      ))}
    </div>
  )
}
