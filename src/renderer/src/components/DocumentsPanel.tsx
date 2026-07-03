import type { VaultDoc } from '@shared/types'
import { Panel } from './Panel'

function age(mtime: number): string {
  const m = Math.floor((Date.now() - mtime) / 60_000)
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export function DocumentsPanel({ docs }: { docs: VaultDoc[] }) {
  return (
    <Panel title="Documents" corner="VAULT.TRAIL">
      {docs.length === 0 && <div className="dim">nothing generated yet</div>}
      {docs.slice(0, 6).map((d) => (
        <div
          key={d.relPath}
          onClick={() => window.vault.openDoc(d.relPath)}
          style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', gap: 8 }}
        >
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</span>
          <span className="dim">{age(d.mtime)}</span>
        </div>
      ))}
    </Panel>
  )
}
