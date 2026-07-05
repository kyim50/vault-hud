import { describe, it, expect } from 'vitest'
import { resolveGeometry, GEOMETRY_BOUNDS } from '../src/renderer/src/lib/resolveGeometry'

describe('resolveGeometry', () => {
  it('no config → defaults 280/300/560', () => {
    expect(resolveGeometry(undefined)).toEqual({ leftWidth: 280, rightWidth: 300, coreMax: 560 })
  })
  it('clamps below and above bounds', () => {
    expect(resolveGeometry({ leftWidth: 50 }).leftWidth).toBe(180)
    expect(resolveGeometry({ rightWidth: 9999 }).rightWidth).toBe(460)
    expect(resolveGeometry({ coreMax: 100 }).coreMax).toBe(360)
    expect(resolveGeometry({ coreMax: 5000 }).coreMax).toBe(1000)
  })
  it('passes in-range values through', () => {
    expect(resolveGeometry({ leftWidth: 350, rightWidth: 220, coreMax: 700 })).toEqual({ leftWidth: 350, rightWidth: 220, coreMax: 700 })
  })
  it('fail-soft: non-number / NaN falls back to default, per field', () => {
    expect(resolveGeometry({ leftWidth: '300px' as unknown as number }).leftWidth).toBe(280)
    expect(resolveGeometry({ rightWidth: NaN }).rightWidth).toBe(300)
    expect(resolveGeometry({ leftWidth: 200, coreMax: 'big' as unknown as number })).toEqual({ leftWidth: 200, rightWidth: 300, coreMax: 560 })
  })
  it('exports the bounds used by the UI', () => {
    expect(GEOMETRY_BOUNDS.leftWidth).toEqual([180, 460])
    expect(GEOMETRY_BOUNDS.coreMax).toEqual([360, 1000])
  })
})
