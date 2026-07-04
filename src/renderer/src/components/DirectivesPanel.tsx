import type { Directive } from '@shared/types'
import { Panel } from './Panel'

export function DirectivesPanel({ directives }: { directives: Directive[] }) {
  const top = directives.filter((d) => !d.done).slice(0, 3)
  const doneCount = directives.filter((d) => d.done).length
  return (
    <Panel title="Directives" corner={`${doneCount}/${directives.length} DONE`}>
      {top.length === 0 && (
        <div className="dim">
          {directives.length > 0 ? 'all directives complete' : 'no plan yet — run PLAN TODAY'}
        </div>
      )}
      {top.map((d) => (
        <label key={`${d.file}:${d.line}`} style={{ display: 'flex', gap: 8, cursor: 'pointer', alignItems: 'baseline' }}>
          <input
            type="checkbox"
            checked={d.done}
            onChange={(e) => window.vault.toggleDirective(d, e.target.checked)}
            style={{ accentColor: 'var(--ink)' }}
          />
          <span>{d.text}</span>
        </label>
      ))}
    </Panel>
  )
}
