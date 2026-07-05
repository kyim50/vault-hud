import { describe, it, expect } from 'vitest'
import { measurePixelText, drawPixelText, GLYPH_H } from '../src/renderer/src/lib/pixelfont'

// minimal ctx double that records fills
function fakeCtx() {
  const rects: [number, number, number, number][] = []
  return {
    rects,
    fillStyle: '',
    fillRect: (x: number, y: number, w: number, h: number) => rects.push([x, y, w, h])
  } as unknown as CanvasRenderingContext2D & { rects: [number, number, number, number][] }
}

describe('measurePixelText', () => {
  it('measures advance-width minus trailing gap, scaled', () => {
    expect(measurePixelText('AB')).toBe(7) // 2*4 - 1
    expect(measurePixelText('AB', 2)).toBe(14)
    expect(measurePixelText('')).toBe(0)
  })
})

describe('drawPixelText', () => {
  it('draws only within the text box and uppercases input', () => {
    const ctx = fakeCtx()
    drawPixelText(ctx, 'inbox', 10, 20, { color: '#fff' })
    expect(ctx.rects.length).toBeGreaterThan(20)
    for (const [x, y, w, h] of ctx.rects) {
      expect(w).toBe(1)
      expect(h).toBe(1)
      expect(x).toBeGreaterThanOrEqual(10)
      expect(x).toBeLessThan(10 + measurePixelText('INBOX'))
      expect(y).toBeGreaterThanOrEqual(20)
      expect(y).toBeLessThan(20 + GLYPH_H)
    }
  })
  it('centers and right-aligns around the anchor', () => {
    const c1 = fakeCtx()
    drawPixelText(c1, 'AA', 50, 0, { color: '#fff', align: 'center' })
    const xs1 = c1.rects.map((r) => r[0])
    expect((Math.min(...xs1) + Math.max(...xs1)) / 2).toBeCloseTo(50, -1)
    const c2 = fakeCtx()
    drawPixelText(c2, 'AA', 50, 0, { color: '#fff', align: 'right' })
    expect(Math.max(...c2.rects.map((r) => r[0]))).toBeLessThan(50)
  })
  it('skips unknown glyphs as spaces instead of crashing', () => {
    const ctx = fakeCtx()
    expect(() => drawPixelText(ctx, '日本 ok', 0, 0, { color: '#fff' })).not.toThrow()
  })
})
