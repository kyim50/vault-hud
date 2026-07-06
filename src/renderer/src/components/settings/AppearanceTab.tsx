import type { Density, HudSnapshot } from '@shared/types'
import { BUILTINS } from '../../theme/builtins'
import { Section, Row, Chips, Toggle, Picker } from './primitives'

export function AppearanceTab({ snap }: { snap: HudSnapshot }) {
  const themes = Array.from(new Set([...Object.keys(BUILTINS), ...Object.keys(snap.userThemes)]))
  const activeName = snap.ui.theme
  const userDef = snap.userThemes[activeName]
  const editable = !!userDef // built-ins (terminal/paper) are not in userThemes
  const patchTheme = (patch: Record<string, unknown>): void => {
    if (!userDef) return
    window.vault.updateConfig({ ui: { themes: { ...snap.ui.themes, [activeName]: { ...userDef, ...patch } } } })
  }
  const FONTS = ['', 'ui-monospace', 'Menlo', 'Consolas', 'Courier New']
  return (
    <>
      <Section title="THEME">
        <Row label="THEME">
          <Chips items={themes} active={snap.ui.theme} onPick={(name) => window.vault.updateConfig({ ui: { theme: name } })} />
        </Row>
      </Section>
      <Section title="STYLE">
        <Row label="DENSITY">
          {editable ? (
            <Chips
              items={['compact', 'cozy', 'airy']}
              active={userDef.density ?? 'cozy'}
              onPick={(d) => patchTheme({ density: d as Density })}
            />
          ) : (
            <span className="dim" style={{ fontSize: 10 }}>{`${activeName} is built-in — copy it to a user theme to edit`}</span>
          )}
        </Row>
        {editable && (
          <Row label="MONO">
            <Picker value={userDef.fonts?.mono ?? ''} options={FONTS} onPick={(mono) => patchTheme({ fonts: { ...userDef.fonts, mono } })} />
            <span className="dim" style={{ fontSize: 10 }}>front of the mono stack</span>
          </Row>
        )}
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
