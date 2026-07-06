import { describe, it, expect } from 'vitest'
import { resolveLayout, DEFAULT_ZONES } from '../src/renderer/src/lib/resolveLayout'

const VALID = new Set(['fetch', 'vitals', 'directives', 'brain', 'core', 'deck', 'schedule', 'totem', 'skills'])

describe('resolveLayout', () => {
  it('no config → DEFAULT_ZONES (parity with today)', () => {
    expect(resolveLayout(undefined, VALID)).toEqual([
      ['fetch', 'vitals', 'directives', 'brain'],
      ['core'],
      ['deck', 'schedule', 'totem', 'skills']
    ])
  })

  it('returns a fresh copy (never the DEFAULT_ZONES reference)', () => {
    expect(resolveLayout(undefined, VALID)).not.toBe(DEFAULT_ZONES)
  })

  it('migrates legacy {left,right} → [left, [core], right]', () => {
    expect(resolveLayout({ left: ['fetch', 'vitals'], right: ['deck'] }, VALID)).toEqual([
      ['fetch', 'vitals'],
      ['core'],
      ['deck']
    ])
  })

  it('passes an explicit zones array through, sanitized', () => {
    expect(resolveLayout({ zones: [['core', 'brain'], ['deck']] }, VALID)).toEqual([['core', 'brain'], ['deck']])
  })

  it('drops ids not in the registry', () => {
    expect(resolveLayout({ zones: [['core', 'bogus'], ['deck']] }, VALID)).toEqual([['core'], ['deck']])
  })

  it('dedupes an id appearing in multiple zones (first wins)', () => {
    expect(resolveLayout({ zones: [['core'], ['core', 'deck']] }, VALID)).toEqual([['core'], ['deck']])
  })

  it('keeps an empty zone as long as another zone has content (drop target persists)', () => {
    expect(resolveLayout({ zones: [['core'], []] }, VALID)).toEqual([['core'], []])
  })

  it('a user-removed module stays removed (not re-appended)', () => {
    // no `core` anywhere — must NOT be force-added back
    expect(resolveLayout({ zones: [['fetch'], ['deck']] }, VALID)).toEqual([['fetch'], ['deck']])
  })

  it('fail-soft: non-array zones → DEFAULT_ZONES', () => {
    expect(resolveLayout({ zones: 'core' as unknown as string[][] }, VALID)).toEqual(DEFAULT_ZONES)
  })

  it('fail-soft: empty array → DEFAULT_ZONES', () => {
    expect(resolveLayout({ zones: [] }, VALID)).toEqual(DEFAULT_ZONES)
  })

  it('fail-soft: all-empty zones → DEFAULT_ZONES (never a blank HUD)', () => {
    expect(resolveLayout({ zones: [[], []] }, VALID)).toEqual(DEFAULT_ZONES)
  })
})
