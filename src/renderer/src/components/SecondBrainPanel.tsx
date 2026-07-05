import { useState } from 'react'
import type { VaultDoc } from '@shared/types'
import { Panel } from './Panel'

function age(mtime: number): string {
  const m = Math.floor((Date.now() - mtime) / 60_000)
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

// Whole-workspace view: quick capture straight into Inbox.md, the freshest
// notes anywhere in the folder, and one resurfaced note from the archive.
// Hovering a note asks the Core canvas to reveal the constellation graph.
export function reveal(relPath: string | null): void {
  window.dispatchEvent(new CustomEvent('vault:constellation', { detail: relPath }))
}

export function SecondBrainPanel({ recent, resurfaced }: { recent: VaultDoc[]; resurfaced: VaultDoc | null }) {
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const send = (): void => {
    if (!text.trim()) return
    window.vault.capture(text)
    setText('')
    setSent(true)
    setTimeout(() => setSent(false), 1500)
  }
  return (
    <Panel style={{ flex: 1 }} title="Second Brain" corner={sent ? '→ INBOX ✓' : 'VAULT'}>
      <input
        value={text}
        placeholder="capture a thought → Inbox.md"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        style={{
          background: 'var(--bg)',
          color: 'var(--ink)',
          border: '1px dotted var(--line-soft)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          padding: '4px 6px',
          outline: 'none'
        }}
      />
      {recent.map((d) => (
        <div
          key={d.relPath}
          onClick={() => window.vault.openDoc(d.relPath)}
          onMouseEnter={() => reveal(d.relPath)}
          onMouseLeave={() => reveal(null)}
          style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', gap: 8 }}
        >
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</span>
          <span className="dim" style={{ flexShrink: 0 }}>{age(d.mtime)}</span>
        </div>
      ))}
      {recent.length === 0 && <div className="dim">vault is quiet — capture something</div>}
      {resurfaced && (
        <div
          onClick={() => window.vault.openDoc(resurfaced.relPath)}
          onMouseEnter={() => reveal(resurfaced.relPath)}
          onMouseLeave={() => reveal(null)}
          style={{ borderTop: '1px dotted var(--line-soft)', paddingTop: 5, cursor: 'pointer' }}
          title="a note you haven't touched in a while"
        >
          <span className="clay">↻ </span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resurfaced.title}</span>
          <span className="dim"> · {age(resurfaced.mtime)} ago</span>
        </div>
      )}
    </Panel>
  )
}
