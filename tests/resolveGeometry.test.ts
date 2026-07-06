import { describe, it, expect } from 'vitest'
import { resolveGeometry, resolveCoreMax, GEOMETRY_BOUNDS } from '../src/renderer/src/lib/resolveGeometry'

describe('resolveGeometry', () => {
  it('no config, 3 zones → parity widths [280,260,300], flex=1, coreMax=560', () => {
    expect(resolveGeometry(undefined, 3)).toEqual({ zoneWidths: [280, 260, 300], flexZone: 1, coreMax: 560 })
  })

  it('produces exactly zoneCount widths, defaulting extras to 260', () => {
    const g = resolveGeometry(undefined, 5)
    expect(g.zoneWidths).toEqual([280, 260, 300, 260, 260])
  })

  it('clamps per-zone widths into [180,460]', () => {
    expect(resolveGeometry({ zoneWidths: [50, 9999, 300] }, 3).zoneWidths).toEqual([180, 460, 300])
  })

  it('migrates legacy leftWidth/rightWidth → [left, 260, right], flex=1', () => {
    const g = resolveGeometry({ leftWidth: 240, rightWidth: 320 }, 3)
    expect(g.zoneWidths).toEqual([240, 260, 320])
    expect(g.flexZone).toBe(1)
  })

  it('clamps flexZone into [0, zoneCount-1]', () => {
    expect(resolveGeometry({ flexZone: 9 }, 3).flexZone).toBe(2)
    expect(resolveGeometry({ flexZone: -4 }, 3).flexZone).toBe(0)
  })

  it('default flexZone with no legacy is the middle index', () => {
    expect(resolveGeometry({ zoneWidths: [200, 200, 200, 200] }, 4).flexZone).toBe(2)
  })

  it('fail-soft: non-numeric width → default; non-numeric flexZone → middle', () => {
    expect(resolveGeometry({ zoneWidths: ['x' as unknown as number, 200, 200] }, 3).zoneWidths[0]).toBe(280)
    expect(resolveGeometry({ flexZone: 'mid' as unknown as number }, 3).flexZone).toBe(1)
  })

  it('coreMax clamps and defaults; resolveCoreMax matches', () => {
    expect(resolveGeometry({ coreMax: 100 }, 3).coreMax).toBe(360)
    expect(resolveGeometry({ coreMax: 5000 }, 3).coreMax).toBe(1000)
    expect(resolveCoreMax({ coreMax: 700 })).toBe(700)
    expect(resolveCoreMax(undefined)).toBe(560)
  })

  it('zoneCount floors to at least 1', () => {
    expect(resolveGeometry(undefined, 0).zoneWidths).toEqual([280])
  })

  it('exports the bounds used by the UI', () => {
    expect(GEOMETRY_BOUNDS.zoneWidth).toEqual([180, 460])
    expect(GEOMETRY_BOUNDS.coreMax).toEqual([360, 1000])
  })

  it('default flexZone follows the core zone hint when given', () => {
    expect(resolveGeometry({ zoneWidths: [200, 200, 200] }, 3, 0).flexZone).toBe(0)
  })

  it('explicit flexZone still wins over the core-zone hint', () => {
    expect(resolveGeometry({ flexZone: 2 }, 3, 0).flexZone).toBe(2)
  })
})
