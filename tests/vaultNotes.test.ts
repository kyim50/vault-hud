import { describe, it, expect } from 'vitest'
import {
  parseDirectives,
  parseSchedule,
  toggleDirectiveLine,
  planFileName,
  localDateStamp
} from '../src/main/collectors/vaultNotes'

const plan = ['# Plan', '', '- [ ] Ship the HUD shell', '- [x] Write the spec', 'notes', '- [ ] Call the bank'].join('\n')

describe('parseDirectives', () => {
  it('extracts checkbox tasks with line numbers and done state', () => {
    const d = parseDirectives(plan, 'Plans/2026-07-03 Plan.md')
    expect(d).toEqual([
      { text: 'Ship the HUD shell', done: false, line: 2, file: 'Plans/2026-07-03 Plan.md' },
      { text: 'Write the spec', done: true, line: 3, file: 'Plans/2026-07-03 Plan.md' },
      { text: 'Call the bank', done: false, line: 5, file: 'Plans/2026-07-03 Plan.md' }
    ])
  })
})

describe('parseSchedule', () => {
  it('extracts time-prefixed lines', () => {
    const md = ['## Schedule', '- 09:30 Standup', '* 14:00 Edit pass + B-roll', '- no time here'].join('\n')
    expect(parseSchedule(md)).toEqual([
      { time: '09:30', text: 'Standup' },
      { time: '14:00', text: 'Edit pass + B-roll' }
    ])
  })
})

describe('toggleDirectiveLine', () => {
  it('checks an unchecked line, leaving others alone', () => {
    const out = toggleDirectiveLine(plan, 2, true)
    expect(out.split('\n')[2]).toBe('- [x] Ship the HUD shell')
    expect(out.split('\n')[3]).toBe('- [x] Write the spec')
  })
  it('unchecks a checked line', () => {
    const out = toggleDirectiveLine(plan, 3, false)
    expect(out.split('\n')[3]).toBe('- [ ] Write the spec')
  })
})

describe('planFileName', () => {
  it('formats YYYY-MM-DD Plan.md', () => {
    expect(planFileName(new Date(2026, 6, 3))).toBe('2026-07-03 Plan.md')
  })
})

describe('localDateStamp', () => {
  it('formats a local date as YYYY-MM-DD using local time, not UTC', () => {
    // 23:30 local on July 3rd — in western timezones, .toISOString() would
    // roll this to July 4th UTC. The regression this fix prevents.
    expect(localDateStamp(new Date(2026, 6, 3, 23, 30))).toBe('2026-07-03')
  })
})
