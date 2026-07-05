import { describe, it, expect } from 'vitest'
import { spriteToHalfBlocks } from '../src/renderer/src/lib/blockart'
import { DEFAULT_PALETTE } from '../src/renderer/src/lib/panda'

describe('spriteToHalfBlocks', () => {
  it('pairs two sprite rows into one glyph row, preserving width', () => {
    const out = spriteToHalfBlocks(['BB', 'BB', 'B.', '.B'], DEFAULT_PALETTE)
    expect(out).toHaveLength(2)
    expect(out[0]).toHaveLength(2)
    expect(out[0][0].ch).toBe('▀')
  })
  it('maps the top pixel to fg and the bottom pixel to bg', () => {
    const out = spriteToHalfBlocks(['B', '.'], DEFAULT_PALETTE)
    expect(out[0][0].fg).toBe(DEFAULT_PALETTE.body) // 'B' -> body
    expect(out[0][0].bg).toBeNull() // '.' -> transparent
  })
  it('pairs an odd trailing row against transparent', () => {
    const out = spriteToHalfBlocks(['B'], DEFAULT_PALETTE)
    expect(out).toHaveLength(1)
    expect(out[0][0].fg).toBe(DEFAULT_PALETTE.body)
    expect(out[0][0].bg).toBeNull()
  })
})
