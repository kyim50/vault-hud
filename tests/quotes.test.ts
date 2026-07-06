import { describe, it, expect } from 'vitest'
import { parseQuotes, mergeQuotes, DEFAULT_QUOTES } from '../src/main/collectors/quotes'

describe('parseQuotes', () => {
  it('reads markdown list items and plain lines, stripping wrapping quotes', () => {
    const md = '# Quotes\n- first one\n- "second, quoted"\n\nthird line\n'
    expect(parseQuotes(md)).toEqual(['first one', 'second, quoted', 'third line'])
  })
  it('ignores blank lines and a lone heading', () => {
    expect(parseQuotes('# Quotes\n\n')).toEqual([])
  })
})

describe('mergeQuotes', () => {
  it('falls back to defaults when there is no vault file', () => {
    expect(mergeQuotes(null)).toEqual(DEFAULT_QUOTES)
  })
  it('puts vault quotes first, then defaults, deduped', () => {
    const out = mergeQuotes('- custom line')
    expect(out[0]).toBe('custom line')
    expect(out).toEqual(['custom line', ...DEFAULT_QUOTES])
    expect(new Set(out).size).toBe(out.length) // no dupes
  })
})
