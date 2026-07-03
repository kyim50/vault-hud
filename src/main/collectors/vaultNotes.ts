import type { Directive, ScheduleItem } from '@shared/types'

const CHECKBOX = /^\s*[-*]\s*\[( |x|X)\]\s+(.*)$/

export function parseDirectives(md: string, file: string): Directive[] {
  const out: Directive[] = []
  md.split('\n').forEach((raw, i) => {
    const m = raw.match(CHECKBOX)
    if (m) out.push({ text: m[2].trim(), done: m[1].toLowerCase() === 'x', line: i, file })
  })
  return out
}

const TIMELINE = /^\s*[-*]?\s*(\d{1,2}:\d{2})\s+(.+)$/

export function parseSchedule(md: string): ScheduleItem[] {
  const out: ScheduleItem[] = []
  for (const raw of md.split('\n')) {
    const m = raw.match(TIMELINE)
    if (m) out.push({ time: m[1], text: m[2].trim() })
  }
  return out
}

export function toggleDirectiveLine(md: string, line: number, done: boolean): string {
  const lines = md.split('\n')
  if (line < 0 || line >= lines.length) return md
  lines[line] = lines[line].replace(/\[( |x|X)\]/, done ? '[x]' : '[ ]')
  return lines.join('\n')
}

export function localDateStamp(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function planFileName(date: Date): string {
  return `${localDateStamp(date)} Plan.md`
}
