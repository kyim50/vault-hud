import type { CSSProperties, ReactNode } from 'react'

export function Panel({
  title,
  corner,
  children,
  style
}: {
  title: string
  corner?: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <section className="panel" style={style}>
      <header className="panel-title">
        <span>{title}</span>
        {corner && <span className="corner">{corner}</span>}
      </header>
      {children}
    </section>
  )
}
