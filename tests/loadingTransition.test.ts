import { describe, it, expect } from 'vitest'
import { loadingPhase, OUT_END, IN_START } from '../src/renderer/src/lib/loadingTransition'

describe('loadingPhase', () => {
  it('dissolves the outgoing scene out over the first phase', () => {
    expect(loadingPhase(0)).toEqual({ phase: 'out', mix: 0 })
    const mid = loadingPhase(OUT_END / 2)
    expect(mid.phase).toBe('out')
    expect(mid.mix).toBeCloseTo(0.5)
  })

  it('holds the loading beat through the middle', () => {
    const beat = loadingPhase((OUT_END + IN_START) / 2)
    expect(beat.phase).toBe('hold')
    expect(beat.mix).toBe(1)
  })

  it('dissolves the incoming scene in over the last phase', () => {
    expect(loadingPhase(IN_START).phase).toBe('in')
    expect(loadingPhase(IN_START).mix).toBeCloseTo(0)
    expect(loadingPhase(1)).toEqual({ phase: 'in', mix: 1 })
  })

  it('mix stays within [0,1] across the whole window', () => {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const { mix } = loadingPhase(t)
      expect(mix).toBeGreaterThanOrEqual(0)
      expect(mix).toBeLessThanOrEqual(1)
    }
  })

  it('clamps t outside [0,1]', () => {
    expect(loadingPhase(-0.5)).toEqual({ phase: 'out', mix: 0 })
    expect(loadingPhase(1.5)).toEqual({ phase: 'in', mix: 1 })
  })
})
