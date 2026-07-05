import { describe, it, expect } from 'vitest'
import {
  PANDA,
  PANDA_W,
  PANDA_BUDDY,
  PANDA_BUDDY_W,
  PANDA_MINI,
  PANDA_MINI_W,
  pandaColor,
  DEFAULT_PALETTE
} from '../src/renderer/src/lib/panda'

const matrices: [string, string[], number][] = [
  ['PANDA', PANDA, PANDA_W],
  ['PANDA_BUDDY', PANDA_BUDDY, PANDA_BUDDY_W],
  ['PANDA_MINI', PANDA_MINI, PANDA_MINI_W]
]

describe.each(matrices)('%s matrix', (_name, rows, width) => {
  it('has uniform row widths', () => {
    for (const r of rows) expect(r.length).toBe(width)
  })
  it('has triangular ears on top (dark, narrower at the tip)', () => {
    const tip = (rows[0].match(/n/g) ?? []).length
    const base = (rows[1].match(/n/g) ?? []).length
    expect(tip).toBeGreaterThan(0)
    expect(base).toBeGreaterThanOrEqual(tip)
  })
  it('is a simplified blob — no tail rings, muzzle mask, or nose', () => {
    const flat = rows.join('')
    expect(flat).not.toContain('I') // no ringed tail
    expect(flat).not.toContain('M') // no cream muzzle mask
    expect(flat).not.toContain('o') // no nose
  })
  it('uses only known palette chars', () => {
    for (const r of rows) for (const ch of r) expect('.BDnEMILo').toContain(ch)
  })
})

describe('PANDA legs', () => {
  it('stands on 4 vertical stubby leg groups', () => {
    const legRow = PANDA[PANDA.length - 1]
    const groups = legRow.split(/\.+/).filter((g) => g.includes('L'))
    expect(groups).toHaveLength(4)
    // vertical: same columns in the row above
    expect(PANDA[PANDA.length - 2]).toBe(legRow)
  })
})

describe('pandaColor', () => {
  it('maps the char language to the ink+clay palette', () => {
    expect(pandaColor('B', DEFAULT_PALETTE, false)).toBe(DEFAULT_PALETTE.body)
    expect(pandaColor('I', DEFAULT_PALETTE, false)).toBe(DEFAULT_PALETTE.ink)
    expect(pandaColor('E', DEFAULT_PALETTE, false)).toBe(DEFAULT_PALETTE.eye)
    expect(pandaColor('E', DEFAULT_PALETTE, true)).toBe(DEFAULT_PALETTE.body) // blink
    expect(pandaColor('.', DEFAULT_PALETTE, false)).toBeNull()
  })
})
