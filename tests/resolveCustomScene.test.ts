import { describe, it, expect } from 'vitest'
import { resolveCustomScene, resolveCustomScenes } from '../src/renderer/src/lib/resolveCustomScene'

const sprites = new Set(['cat', 'tree'])
const reserved = new Set(['meadow', 'night'])
const ok = { name: 'yard', sky: ['#223', '#001'], ground: '#0a0', props: [{ sprite: 'cat', x: 50, y: 60, scale: 2, drift: true }] }

describe('resolveCustomScene', () => {
  it('passes a valid scene through', () => {
    expect(resolveCustomScene(ok, sprites, reserved)).toEqual(ok)
  })
  it('drops a prop whose sprite is not in the library', () => {
    const r = resolveCustomScene({ ...ok, props: [{ sprite: 'ghost', x: 1, y: 1, scale: 1 }, ok.props[0]] }, sprites, reserved)
    expect(r?.props).toHaveLength(1)
    expect(r?.props[0].sprite).toBe('cat')
  })
  it('clamps x/y to [0,100] and scale to [1,4], coerces drift', () => {
    const r = resolveCustomScene({ ...ok, props: [{ sprite: 'cat', x: -20, y: 300, scale: 9, drift: 1 }] }, sprites, reserved)
    expect(r?.props[0]).toEqual({ sprite: 'cat', x: 0, y: 100, scale: 4, drift: true })
  })
  it('falls back on bad sky/ground', () => {
    const r = resolveCustomScene({ name: 'x', sky: 'nope', ground: 5, props: [] }, sprites, reserved)
    expect(r?.sky).toEqual(['#12131a', '#05060a'])
    expect(r?.ground).toBe('#0e1013')
  })
  it('rejects empty / non-string / reserved names → null', () => {
    expect(resolveCustomScene({ ...ok, name: '' }, sprites, reserved)).toBeNull()
    expect(resolveCustomScene({ ...ok, name: 5 }, sprites, reserved)).toBeNull()
    expect(resolveCustomScene({ ...ok, name: 'meadow' }, sprites, reserved)).toBeNull()
  })
  it('never throws on garbage', () => {
    expect(resolveCustomScene(null, sprites, reserved)).toBeNull()
    expect(resolveCustomScene(42, sprites, reserved)).toBeNull()
  })
})

describe('resolveCustomScenes', () => {
  it('empty / non-array → [] (parity: merged registry == built-ins)', () => {
    expect(resolveCustomScenes(undefined, sprites, reserved)).toEqual([])
    expect(resolveCustomScenes('x', sprites, reserved)).toEqual([])
  })
  it('drops duplicates by name (first wins)', () => {
    const r = resolveCustomScenes([ok, { ...ok, ground: '#fff' }], sprites, reserved)
    expect(r).toHaveLength(1)
    expect(r[0].ground).toBe('#0a0')
  })
})
