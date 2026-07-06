import { describe, it, expect } from 'vitest'
import { resolvePanelSize, DEFAULT_GROW } from '../src/renderer/src/lib/resolvePanelSize'

describe('resolvePanelSize', () => {
  it('no cfg → grow follows the default-grow flag, no height (parity)', () => {
    expect(resolvePanelSize(undefined, true)).toEqual({ grow: true, height: null })
    expect(resolvePanelSize(undefined, false)).toEqual({ grow: false, height: null })
  })
  it('explicit grow overrides the default', () => {
    expect(resolvePanelSize({ grow: false }, true).grow).toBe(false)
    expect(resolvePanelSize({ grow: true }, false).grow).toBe(true)
  })
  it('height clamps to [80,900] when grow is off', () => {
    expect(resolvePanelSize({ grow: false, height: 20 }, false).height).toBe(80)
    expect(resolvePanelSize({ grow: false, height: 5000 }, false).height).toBe(900)
    expect(resolvePanelSize({ grow: false, height: 300 }, false).height).toBe(300)
  })
  it('grow true forces height null even if a height is set', () => {
    expect(resolvePanelSize({ grow: true, height: 300 }, false)).toEqual({ grow: true, height: null })
  })
  it('fail-soft: non-boolean grow → default; non-number height → null', () => {
    expect(resolvePanelSize({ grow: 'yes' as unknown as boolean }, true).grow).toBe(true)
    expect(resolvePanelSize({ grow: false, height: 'tall' as unknown as number }, false).height).toBe(null)
  })
  it('exports the default-grow set (brain/skills/core)', () => {
    expect(DEFAULT_GROW.has('brain')).toBe(true)
    expect(DEFAULT_GROW.has('skills')).toBe(true)
    expect(DEFAULT_GROW.has('core')).toBe(true)
    expect(DEFAULT_GROW.has('deck')).toBe(false)
  })
})
