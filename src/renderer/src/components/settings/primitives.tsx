import type { ReactNode } from 'react'

const label = { fontFamily: 'var(--font-pixel)', fontSize: 7, letterSpacing: 1 } as const

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ borderTop: '1px dotted var(--line-soft)', paddingTop: 10, marginTop: 4 }}>
      <div style={{ ...label, marginBottom: 8, color: 'var(--ink-dim)' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

export function Row({ label: text, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 11 }}>
      <span style={{ ...label, width: 64, flexShrink: 0, paddingTop: 3 }}>{text}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export function Stepper({ value, suffix, onDec, onInc }: { value: number | string; suffix?: string; onDec: () => void; onInc: () => void }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={onDec} style={{ fontSize: 10 }}>−</button>
      <span className="dim" style={{ fontSize: 10, minWidth: 64, textAlign: 'center' }}>
        {value}{suffix ?? ''}
      </span>
      <button onClick={onInc} style={{ fontSize: 10 }}>+</button>
    </span>
  )
}

export function Toggle({ on, label: text, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ color: on ? 'var(--clay)' : 'var(--ink)', fontSize: 10 }}>
      {on ? '● ' : '○ '}{text}
    </button>
  )
}

export function Chips({ items, active, onPick }: { items: string[]; active: string | ((s: string) => boolean); onPick: (s: string) => void }) {
  const isOn = (s: string): boolean => (typeof active === 'function' ? active(s) : active === s)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((s) => (
        <Toggle key={s} on={isOn(s)} label={s} onClick={() => onPick(s)} />
      ))}
    </div>
  )
}

export function Picker({ value, options, onPick }: { value: string; options: string[]; onPick: (s: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onPick(e.target.value)}
      style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 4px' }}
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}
