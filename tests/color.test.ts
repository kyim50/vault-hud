// tests/color.test.ts
import { describe, it, expect } from 'vitest'
import { parseHex, toHex, mix, lighten, darken } from '../src/renderer/src/theme/color'

describe('color', () => {
  it('parses 6-digit and 3-digit hex', () => {
    expect(parseHex('#d97757')).toEqual([217, 119, 87])
    expect(parseHex('#fff')).toEqual([255, 255, 255])
  })
  it('round-trips through toHex', () => {
    expect(toHex([217, 119, 87])).toBe('#d97757')
    expect(toHex([0, 0, 0])).toBe('#000000')
  })
  it('mix(t=0) is a, mix(t=1) is b, mix(0.5) is midpoint', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
  it('lighten moves toward white, darken toward black', () => {
    expect(lighten('#808080', 1)).toBe('#ffffff')
    expect(darken('#808080', 1)).toBe('#000000')
  })
  it('tolerates missing # and clamps out-of-range t', () => {
    expect(parseHex('d97757')).toEqual([217, 119, 87])
    expect(mix('#000000', '#ffffff', 2)).toBe('#ffffff')
    expect(mix('#000000', '#ffffff', -1)).toBe('#000000')
  })
})
