import { describe, it, expect } from 'vitest'
import { resolveNotch } from '../src/shared/resolveNotch'

describe('resolveNotch', () => {
  it('no config → defaults enabled/440/140', () => {
    expect(resolveNotch(undefined)).toEqual({ enabled: true, width: 440, expandedHeight: 140 })
  })
  it('enabled false is respected', () => {
    expect(resolveNotch({ enabled: false }).enabled).toBe(false)
  })
  it('width clamps [240,900], expandedHeight clamps [80,600]', () => {
    expect(resolveNotch({ width: 100 }).width).toBe(240)
    expect(resolveNotch({ width: 5000 }).width).toBe(900)
    expect(resolveNotch({ expandedHeight: 10 }).expandedHeight).toBe(80)
    expect(resolveNotch({ expandedHeight: 5000 }).expandedHeight).toBe(600)
  })
  it('fail-soft: non-number/non-boolean → defaults, per field', () => {
    expect(resolveNotch({ width: 'x' as unknown as number }).width).toBe(440)
    expect(resolveNotch({ enabled: 'yes' as unknown as boolean }).enabled).toBe(true)
    expect(resolveNotch({ expandedHeight: NaN }).expandedHeight).toBe(140)
  })
})
