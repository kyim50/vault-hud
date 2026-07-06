import type { HudSnapshot } from '@shared/types'
import { resolveLayout, DEFAULT_ZONES } from '../../lib/resolveLayout'
import { resolveGeometry, GEOMETRY_BOUNDS } from '../../lib/resolveGeometry'
import { resolveModule } from '../../modules/resolve'
import { resolvePanelSize, DEFAULT_GROW } from '../../lib/resolvePanelSize'
import { resolveNotch, NOTCH_BOUNDS } from '@shared/resolveNotch'
import { Section, Row, Stepper, Toggle, Picker } from './primitives'

// every module appears in the canonical default layout — use it as the id list
const MODULE_IDS = Array.from(new Set(DEFAULT_ZONES.flat()))

export function LayoutTab({ snap }: { snap: HudSnapshot }) {
  const validIds = new Set(MODULE_IDS)
  const zones = resolveLayout(snap.ui.layout, validIds)
  const coreZone = zones.findIndex((z) => z.includes('core'))
  const geo = resolveGeometry(snap.ui.geometry, zones.length, coreZone)
  const [wmin, wmax] = GEOMETRY_BOUNDS.zoneWidth

  const writeZones = (nextZones: string[][], nextGeo?: { zoneWidths?: number[]; flexZone?: number }): void =>
    window.vault.updateConfig({
      ui: { layout: { zones: nextZones }, geometry: { ...snap.ui.geometry, zoneWidths: geo.zoneWidths, flexZone: geo.flexZone, ...nextGeo } }
    })

  const moveModule = (id: string, toZone: number): void => {
    const next = zones.map((z) => z.filter((m) => m !== id))
    next[toZone].push(id)
    writeZones(next)
  }
  const setWidth = (i: number, px: number): void => {
    const zoneWidths = geo.zoneWidths.slice()
    zoneWidths[i] = Math.max(wmin, Math.min(wmax, px))
    window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, zoneWidths, flexZone: geo.flexZone } } })
  }
  const setFlex = (i: number): void =>
    window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, zoneWidths: geo.zoneWidths, flexZone: i } } })
  const addZone = (): void => writeZones([...zones, []], { zoneWidths: [...geo.zoneWidths, 260] })
  const removeZone = (i: number): void => {
    if (zones.length <= 1) return
    const next = zones.filter((_, j) => j !== i)
    const zoneWidths = geo.zoneWidths.filter((_, j) => j !== i)
    const flexZone = Math.max(0, Math.min(next.length - 1, i < geo.flexZone ? geo.flexZone - 1 : geo.flexZone))
    writeZones(next, { zoneWidths, flexZone })
  }
  const toggleModule = (id: string, on: boolean): void =>
    window.vault.updateConfig({ ui: { modules: { ...snap.ui.modules, [id]: { ...snap.ui.modules?.[id], enabled: on } } } })
  const setCoreMax = (px: number): void => {
    const [cmin, cmax] = GEOMETRY_BOUNDS.coreMax
    window.vault.updateConfig({ ui: { geometry: { ...snap.ui.geometry, coreMax: Math.max(cmin, Math.min(cmax, px)) } } })
  }
  const setGrow = (id: string, grow: boolean): void =>
    window.vault.updateConfig({ ui: { modules: { ...snap.ui.modules, [id]: { ...snap.ui.modules?.[id], grow, ...(grow ? { height: undefined } : {}) } } } })
  const setHeight = (id: string, h: number | null): void =>
    window.vault.updateConfig({ ui: { modules: { ...snap.ui.modules, [id]: { ...snap.ui.modules?.[id], grow: false, height: h == null ? undefined : Math.max(80, Math.min(900, h)) } } } })
  const notch = resolveNotch(snap.ui.notch)
  const setNotch = (patch: Partial<{ enabled: boolean; width: number; expandedHeight: number }>): void => {
    const clamped = { ...patch }
    if (typeof clamped.width === 'number') clamped.width = Math.max(NOTCH_BOUNDS.width[0], Math.min(NOTCH_BOUNDS.width[1], clamped.width))
    if (typeof clamped.expandedHeight === 'number') clamped.expandedHeight = Math.max(NOTCH_BOUNDS.expandedHeight[0], Math.min(NOTCH_BOUNDS.expandedHeight[1], clamped.expandedHeight))
    window.vault.updateConfig({ ui: { notch: { ...snap.ui.notch, ...clamped } } })
  }

  const zoneNames = zones.map((_, i) => String(i))
  return (
    <>
      <Section title="ZONES">
        {zones.map((z, i) => (
          <div key={i} style={{ border: '1px solid var(--line-soft)', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="dim" style={{ fontSize: 10 }}>zone {i}{i === geo.flexZone ? ' · flex' : ''}</span>
              <button onClick={() => removeZone(i)} disabled={zones.length <= 1} style={{ fontSize: 10, color: 'var(--danger)' }}>✕ zone</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {z.length === 0 && <span className="dim" style={{ fontSize: 10 }}>empty</span>}
              {z.map((id) => {
                const size = resolvePanelSize(snap.ui.modules?.[id], DEFAULT_GROW.has(id))
                return (
                  <div key={id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 10 }}>
                    <span style={{ minWidth: 58, color: 'var(--ink)' }}>{id}</span>
                    <Picker value={String(i)} options={zoneNames} onPick={(t) => moveModule(id, Number(t))} />
                    <Toggle on={size.grow} label="grow" onClick={() => setGrow(id, !size.grow)} />
                    {!size.grow && (
                      <Stepper
                        value={size.height ?? 'auto'}
                        suffix={size.height != null ? 'px' : ''}
                        onDec={() => setHeight(id, (size.height ?? 200) - 20)}
                        onInc={() => setHeight(id, (size.height ?? 200) + 20)}
                      />
                    )}
                    {size.height != null && (
                      <button onClick={() => setHeight(id, null)} style={{ fontSize: 10 }}>auto</button>
                    )}
                  </div>
                )
              })}
            </div>
            <Row label="WIDTH">
              {i === geo.flexZone ? (
                <span className="dim" style={{ fontSize: 10 }}>flexes to fill</span>
              ) : (
                <Stepper value={geo.zoneWidths[i]} suffix="px" onDec={() => setWidth(i, geo.zoneWidths[i] - 20)} onInc={() => setWidth(i, geo.zoneWidths[i] + 20)} />
              )}
              <Toggle on={i === geo.flexZone} label="flex" onClick={() => setFlex(i)} />
            </Row>
          </div>
        ))}
        <button onClick={addZone} style={{ fontSize: 10 }}>+ add zone</button>
      </Section>
      <Section title="PANELS">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MODULE_IDS.map((id) => {
            const { enabled } = resolveModule({}, snap.ui.modules?.[id])
            return <Toggle key={id} on={enabled} label={id} onClick={() => toggleModule(id, !enabled)} />
          })}
        </div>
      </Section>
      <Section title="CORE SIZE">
        <Row label="CORE">
          <Stepper value={geo.coreMax} suffix="px" onDec={() => setCoreMax(geo.coreMax - 20)} onInc={() => setCoreMax(geo.coreMax + 20)} />
          <button onClick={() => window.vault.updateConfig({ ui: { geometry: {} } })} style={{ fontSize: 10 }}>reset all sizes</button>
        </Row>
      </Section>
      <Section title="NOTCH">
        <Row label="NOTCH">
          <Toggle
            on={notch.enabled}
            label={notch.enabled ? 'on' : 'off — restart to apply'}
            onClick={() => setNotch({ enabled: !notch.enabled })}
          />
        </Row>
        <Row label="WIDTH">
          <Stepper value={notch.width} suffix="px" onDec={() => setNotch({ width: notch.width - 20 })} onInc={() => setNotch({ width: notch.width + 20 })} />
        </Row>
        <Row label="EXPAND">
          <Stepper value={notch.expandedHeight} suffix="px" onDec={() => setNotch({ expandedHeight: notch.expandedHeight - 20 })} onInc={() => setNotch({ expandedHeight: notch.expandedHeight + 20 })} />
        </Row>
      </Section>
    </>
  )
}
