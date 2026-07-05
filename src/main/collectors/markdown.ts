import type { Directive, LinkGraph } from '@shared/types'

// Zero-config markdown engine: works over ANY folder of plain .md files.
// Frontmatter is optional sugar — when a file has none, we fall straight
// back to scanning the body for GFM checkboxes, and deadlines are inferred
// from wherever they naturally live (filename, inline tag, or file mtime).

const FM_DELIM = /^---\s*$/
const FM_KV = /^(\w[\w-]*):\s*(.*)$/
const CHECKBOX = /^\s*[-*]\s*\[( |x|X)\]\s+(.*)$/
const DATE = /\b(\d{4}-\d{2}-\d{2})\b/
const DONE_STATUSES = new Set(['done', 'complete', 'completed', 'archived'])

export function stamp(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// optional YAML frontmatter: flat `key: value` pairs only, silently absent
// when the file doesn't start with a --- block
export function parseFrontmatter(md: string): { attrs: Record<string, string>; endLine: number } {
  const lines = md.split('\n')
  if (!FM_DELIM.test(lines[0] ?? '')) return { attrs: {}, endLine: 0 }
  const attrs: Record<string, string> = {}
  for (let i = 1; i < Math.min(lines.length, 40); i++) {
    if (FM_DELIM.test(lines[i])) return { attrs, endLine: i + 1 }
    const m = lines[i].match(FM_KV)
    if (m) attrs[m[1].toLowerCase()] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return { attrs: {}, endLine: 0 } // unterminated block — treat as body text
}

// deadline for one task line, most-specific wins: inline YYYY-MM-DD, then
// #today / #tomorrow tags; null means "inherit from file"
export function dueFromLine(text: string, today: string): { due: string | null; clean: string } {
  const dateM = text.match(DATE)
  if (dateM) return { due: dateM[1], clean: text.replace(dateM[0], '').replace(/\s{2,}/g, ' ').trim() }
  if (/#today\b/i.test(text)) return { due: today, clean: text.replace(/#today\b/i, '').trim() }
  if (/#(tomorrow|tmrw)\b/i.test(text)) {
    const t = new Date(today + 'T12:00:00')
    t.setDate(t.getDate() + 1)
    return { due: stamp(t), clean: text.replace(/#(tomorrow|tmrw)\b/i, '').trim() }
  }
  return { due: null, clean: text }
}

// file-level deadline from a date-named file (e.g. `2026-07-04.md`,
// `2026-07-04 Plan.md`); null when the name carries no date
export function dateFromFileName(name: string): string | null {
  const m = name.match(DATE)
  return m ? m[1] : null
}

export function extractTasks(
  md: string,
  file: string,
  opts: { fileName: string; mtime: number; today: string }
): Directive[] {
  const { attrs, endLine } = parseFrontmatter(md)
  const fmDue = attrs['due'] && DATE.test(attrs['due']) ? attrs['due'].match(DATE)![1] : null
  const fmDone = DONE_STATUSES.has((attrs['status'] ?? '').toLowerCase())
  const fileDue = fmDue ?? dateFromFileName(opts.fileName) ?? stamp(new Date(opts.mtime))
  const out: Directive[] = []
  md.split('\n').forEach((raw, i) => {
    if (i < endLine) return // skip the frontmatter block itself
    const m = raw.match(CHECKBOX)
    if (!m) return
    const { due, clean } = dueFromLine(m[2].trim(), opts.today)
    out.push({
      text: clean,
      done: fmDone || m[1].toLowerCase() === 'x',
      line: i, // raw file line — write-back toggling depends on this
      file,
      due: due ?? fileDue
    })
  })
  return out
}

// wiki-links: [[Note Name]], [[Note Name|alias]], [[Note Name#heading]]
export function extractWikiLinks(md: string): string[] {
  const out: string[] = []
  for (const m of md.matchAll(/\[\[([^\]|#\n]+)(?:[#|][^\]]*)?\]\]/g)) {
    const name = m[1].trim()
    if (name) out.push(name)
  }
  return out
}

export interface ScannedNote {
  title: string
  relPath: string
  mtime: number
  links: string[] // raw wiki-link targets found in the body
}

// bi-directional, deduplicated link graph: edges connect note indices both
// ways; links to notes that don't exist are ignored
export function buildLinkGraph(notes: ScannedNote[]): LinkGraph {
  const byTitle = new Map<string, number>()
  notes.forEach((n, i) => byTitle.set(n.title.toLowerCase(), i))
  const seen = new Set<string>()
  const edges: [number, number][] = []
  const degree = new Array(notes.length).fill(0)
  notes.forEach((n, i) => {
    for (const target of n.links) {
      const j = byTitle.get(target.toLowerCase())
      if (j === undefined || j === i) continue
      const key = i < j ? `${i}:${j}` : `${j}:${i}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push(i < j ? [i, j] : [j, i])
      degree[i]++
      degree[j]++
    }
  })
  return {
    nodes: notes.map((n, i) => ({ title: n.title, relPath: n.relPath, mtime: n.mtime, links: degree[i] })),
    edges
  }
}
