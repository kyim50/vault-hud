import type { VaultDoc } from '@shared/types'
import { Panel } from './Panel'

export function SkillsPanel({ skills }: { skills: VaultDoc[] }) {
  return (
    <Panel style={{ flex: 1 }} title="Skills" corner={`${skills.length} LEARNED`}>
      {skills.length === 0 && <div className="dim">empty — run SKILL MINER</div>}
      {skills.slice(0, 4).map((s) => (
        <div
          key={s.relPath}
          onClick={() => window.vault.openDoc(s.relPath)}
          style={{ cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          <span className="clay">◆ </span>
          {s.title}
        </div>
      ))}
    </Panel>
  )
}
