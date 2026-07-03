import type { ScheduleItem } from '@shared/types'
import { Panel } from './Panel'

export function SchedulePanel({ schedule }: { schedule: ScheduleItem[] }) {
  return (
    <Panel style={{ flex: 1 }} title="Schedule" corner="TODAY">
      {schedule.length === 0 && <div className="dim">no schedule — run MORNING BRIEF</div>}
      {schedule.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 10 }}>
          <span className="accent" style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, paddingTop: 3 }}>{s.time}</span>
          <span>{s.text}</span>
        </div>
      ))}
    </Panel>
  )
}
