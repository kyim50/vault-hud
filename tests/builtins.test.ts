// tests/builtins.test.ts
import { describe, it, expect } from 'vitest'
import { BUILTINS } from '../src/renderer/src/theme/builtins'
import { resolve } from '../src/renderer/src/theme/resolve'

describe('builtins', () => {
  it('terminal resolves to the current terminal CSS values', () => {
    const t = resolve(BUILTINS.terminal).colors
    expect(t.bg).toBe('#1e1e1e')
    expect(t.surface).toBe('#1e1e1e')
    expect(t.ink).toBe('#e8e6e3')
    expect(t.inkDim).toBe('#8f8f8f')
    expect(t.lineSoft).toBe('#3a3a3a')
    expect(t.mascotBody).toBe('#d97757')
    expect(t.mascotDark).toBe('#b85c3f')
    expect(t.mascotBodyLight).toBe('#e8a284')
  })
  it('paper resolves to the current paper CSS values', () => {
    const p = resolve(BUILTINS.paper).colors
    expect(p.bg).toBe('#f4f2e9')
    expect(p.ink).toBe('#17160f')
    expect(p.inkDim).toBe('#8d8a7a')
    expect(p.lineSoft).toBe('#dcd9ca')
  })
})
