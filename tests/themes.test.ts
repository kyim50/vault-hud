import { describe, it, expect } from 'vitest'
import { parseThemeDef, mergeThemes } from '../src/main/collectors/themes'

describe('parseThemeDef', () => {
  it('parses a valid theme and falls back name to the file stem', () => {
    const t = parseThemeDef('midnight', '{"colors":{"bg":"#0d0f14","ink":"#c8d0e0"}}')
    expect(t).not.toBeNull()
    expect(t!.name).toBe('midnight')
    expect(t!.colors!.bg).toBe('#0d0f14')
  })
  it('keeps an explicit name over the file stem', () => {
    expect(parseThemeDef('foo', '{"name":"Cool","colors":{}}')!.name).toBe('Cool')
  })
  it('returns null for invalid JSON or non-object', () => {
    expect(parseThemeDef('x', 'not json')).toBeNull()
    expect(parseThemeDef('x', '[1,2,3]')).toBeNull()
    expect(parseThemeDef('x', '42')).toBeNull()
  })
})

describe('mergeThemes', () => {
  it('folder themes override inline themes of the same name', () => {
    const inline = { a: { name: 'a', density: 'cozy' as const }, b: { name: 'b' } }
    const folder = { a: { name: 'a', density: 'airy' as const } }
    const m = mergeThemes(inline, folder)
    expect(m.a.density).toBe('airy') // folder wins
    expect(m.b.name).toBe('b') // inline-only preserved
  })
  it('handles undefined inline', () => {
    expect(mergeThemes(undefined, { a: { name: 'a' } })).toEqual({ a: { name: 'a' } })
  })
})
