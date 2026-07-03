import type { ReactNode } from 'react'

export function Panel({ title, corner, children }: { title: string; corner?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-title">
        <span>{title}</span>
        {corner && <span className="corner">{corner}</span>}
      </header>
      {children}
    </section>
  )
}
