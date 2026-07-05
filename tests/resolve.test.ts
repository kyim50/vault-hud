// tests/resolve.test.ts
import { describe, it, expect } from 'vitest'
import { resolve } from '../src/renderer/src/theme/resolve'

describe('resolve', () => {
  it('fills every role from a minimal theme', () => {
    const r = resolve({ colors: { bg: '#0d0f14', ink: '#c8d0e0', accent: '#6ea8ff', mascotBody: '#d97757' } })
    expect(r.colors.bg).toBe('#0d0f14')
    expect(r.colors.surface).toBe('#0d0f14') // ← bg
    expect(r.colors.accent).toBe('#6ea8ff')
    expect(r.colors.mascotEye).toBe('#17160f') // role default
    expect(r.colors.mascotMuzzle).toBe('#f4f2e9')
    expect(r.colors.danger).toBe('#ff6e4e')
    // derived roles are non-empty valid hex
    expect(r.colors.inkDim).toMatch(/^#[0-9a-f]{6}$/)
    expect(r.colors.lineSoft).toMatch(/^#[0-9a-f]{6}$/)
    expect(r.colors.mascotDark).toMatch(/^#[0-9a-f]{6}$/)
    expect(r.colors.mascotBodyLight).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('explicit overrides win over derivation', () => {
    const r = resolve({ colors: { ink: '#ffffff', bg: '#000000', inkDim: '#123456', accent: '#abcdef', accentDim: '#fedcba' } })
    expect(r.colors.inkDim).toBe('#123456')
    expect(r.colors.accent).toBe('#abcdef')
    expect(r.colors.accentDim).toBe('#fedcba')
  })
  it('defaults density to cozy and maps spacing', () => {
    expect(resolve({}).density).toBe('cozy')
    expect(resolve({}).spacing).toEqual({ padX: 10, padY: 8, gap: 5 })
    expect(resolve({ density: 'airy' }).spacing).toEqual({ padX: 14, padY: 12, gap: 8 })
  })
  it('prepends a named font to the fallback stack', () => {
    expect(resolve({ fonts: { mono: 'JetBrains Mono' } }).fonts.mono).toContain("'JetBrains Mono'")
    expect(resolve({ fonts: { mono: 'JetBrains Mono' } }).fonts.mono).toContain('Menlo')
    expect(resolve({}).fonts.mono).toContain('Departure Mono')
  })
})
