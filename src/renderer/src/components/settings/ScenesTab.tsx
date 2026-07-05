import type { HudSnapshot } from '@shared/types'
import { ROTATION_DEFAULT } from '../../lib/resolveScenes'
import { Section, Row, Stepper, Chips } from './primitives'

export function ScenesTab({ snap }: { snap: HudSnapshot }) {
  const rotation = snap.ui.scenes?.rotation ?? ROTATION_DEFAULT
  const interval = snap.ui.scenes?.intervalSec ?? 22
  const toggleScene = (name: string): void => {
    const set = new Set(rotation)
    set.has(name) ? set.delete(name) : set.add(name)
    const next = ROTATION_DEFAULT.filter((n) => set.has(n))
    if (next.length === 0) return // never leave the Core with nothing to show
    window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, rotation: next } } })
  }
  const setInterval = (n: number): void =>
    window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, intervalSec: Math.max(3, Math.min(600, n)) } } })
  return (
    <Section title="ROTATION">
      <Row label="SCENES">
        <Chips items={ROTATION_DEFAULT} active={(n) => rotation.includes(n)} onPick={toggleScene} />
      </Row>
      <Row label="SPEED">
        <Stepper value={interval} suffix="s per scene" onDec={() => setInterval(interval - 4)} onInc={() => setInterval(interval + 4)} />
      </Row>
    </Section>
  )
}
