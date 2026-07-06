import { describe, it, expect } from 'vitest'
import { buildRice, parseRice } from '../src/renderer/src/lib/rice'
import type { HudSnapshot } from '../src/shared/types'

const snap = {
  ui: { theme: 'midnight', parade: true, layout: { zones: [['core']] }, geometry: { coreMax: 700 } },
  userThemes: { midnight: { name: 'midnight', colors: { bg: '#000', ink: '#fff' } } },
  sprites: [{ name: 'cat', grid: [['#f00']], use: 'totem' }]
} as unknown as HudSnapshot

describe('buildRice', () => {
  it('bundles ui, embedded themes, and sprites with version 1', () => {
    const r = buildRice(snap)
    expect(r.v).toBe(1)
    expect(r.ui.theme).toBe('midnight')
    expect(r.themes?.midnight?.colors?.bg).toBe('#000')
    expect(r.sprites?.[0]?.name).toBe('cat')
  })
  it('does not duplicate themes inside ui (defs live only in bundle.themes)', () => {
    expect(buildRice(snap).ui.themes).toBeUndefined()
  })
})

describe('parseRice', () => {
  it('round-trips a built bundle', () => {
    const text = JSON.stringify(buildRice(snap))
    const res = parseRice(text)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.bundle.ui.theme).toBe('midnight')
  })
  it('fail-soft: invalid JSON → error, no throw', () => {
    const res = parseRice('{not json')
    expect(res.ok).toBe(false)
  })
  it('fail-soft: wrong version → error', () => {
    expect(parseRice(JSON.stringify({ v: 2, ui: {} })).ok).toBe(false)
  })
  it('fail-soft: missing ui → error', () => {
    expect(parseRice(JSON.stringify({ v: 1 })).ok).toBe(false)
  })
  it('fail-soft: non-object / array → error', () => {
    expect(parseRice('[]').ok).toBe(false)
    expect(parseRice('42').ok).toBe(false)
  })
  it('fail-soft: non-array sprites → error (no partial apply)', () => {
    expect(parseRice(JSON.stringify({ v: 1, ui: { theme: 'x' }, sprites: 42 })).ok).toBe(false)
  })
  it('fail-soft: non-object themes → error', () => {
    expect(parseRice(JSON.stringify({ v: 1, ui: { theme: 'x' }, themes: [] })).ok).toBe(false)
  })
})
