import { describe, it, expect } from 'vitest'
import { resolveModule } from '../src/renderer/src/modules/resolve'

describe('resolveModule', () => {
  it('enabled by default, options = defaults when no config', () => {
    expect(resolveModule({ a: 1, b: 2 })).toEqual({ enabled: true, options: { a: 1, b: 2 } })
  })
  it('merges option overrides over defaults', () => {
    expect(resolveModule({ a: 1, b: 2 }, { options: { b: 9 } }).options).toEqual({ a: 1, b: 9 })
  })
  it('respects enabled: false', () => {
    expect(resolveModule({}, { enabled: false }).enabled).toBe(false)
  })
})
