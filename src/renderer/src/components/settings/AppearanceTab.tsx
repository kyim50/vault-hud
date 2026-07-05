import type { HudSnapshot } from '@shared/types'
import { BUILTINS } from '../../theme/builtins'
import { Section, Row, Chips, Toggle } from './primitives'

export function AppearanceTab({ snap }: { snap: HudSnapshot }) {
  const themes = Array.from(new Set([...Object.keys(BUILTINS), ...Object.keys(snap.userThemes)]))
  return (
    <>
      <Section title="THEME">
        <Row label="THEME">
          <Chips items={themes} active={snap.ui.theme} onPick={(name) => window.vault.updateConfig({ ui: { theme: name } })} />
        </Row>
      </Section>
      <Section title="FRAME">
        <Row label="FRAME">
          <Toggle
            on={snap.ui.parade}
            label={snap.ui.parade ? 'on — critters patrol the frame' : 'off'}
            onClick={() => window.vault.updateConfig({ ui: { parade: !snap.ui.parade } })}
          />
        </Row>
      </Section>
    </>
  )
}
