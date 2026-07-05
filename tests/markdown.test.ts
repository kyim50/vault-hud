import { describe, it, expect } from 'vitest'
import {
  parseFrontmatter,
  dueFromLine,
  dateFromFileName,
  extractTasks,
  extractWikiLinks,
  buildLinkGraph
} from '../src/main/collectors/markdown'

describe('parseFrontmatter', () => {
  it('parses flat key: value pairs when present', () => {
    const md = ['---', 'status: done', "due: '2026-07-10'", '---', 'body'].join('\n')
    const { attrs, endLine } = parseFrontmatter(md)
    expect(attrs).toEqual({ status: 'done', due: '2026-07-10' })
    expect(endLine).toBe(4)
  })
  it('silently returns empty for plain files (zero-config fallback)', () => {
    expect(parseFrontmatter('# just a note\n- [ ] task')).toEqual({ attrs: {}, endLine: 0 })
  })
  it('treats an unterminated --- block as body text', () => {
    expect(parseFrontmatter('---\nnot: closed').endLine).toBe(0)
  })
})

describe('dueFromLine', () => {
  const today = '2026-07-04'
  it('extracts inline dates and cleans the text', () => {
    expect(dueFromLine('ship the HUD 2026-07-09', today)).toEqual({ due: '2026-07-09', clean: 'ship the HUD' })
  })
  it('resolves #today and #tomorrow tags', () => {
    expect(dueFromLine('call mom #today', today).due).toBe('2026-07-04')
    expect(dueFromLine('gym #tomorrow', today).due).toBe('2026-07-05')
  })
  it('returns null when no natural date appears', () => {
    expect(dueFromLine('just a task', today)).toEqual({ due: null, clean: 'just a task' })
  })
})

describe('dateFromFileName', () => {
  it('reads date-named files', () => {
    expect(dateFromFileName('2026-07-04.md')).toBe('2026-07-04')
    expect(dateFromFileName('2026-07-04 Plan.md')).toBe('2026-07-04')
    expect(dateFromFileName('Ideas.md')).toBeNull()
  })
})

describe('extractTasks', () => {
  const opts = { fileName: 'Ideas.md', mtime: Date.parse('2026-07-01T10:00:00'), today: '2026-07-04' }

  it('falls back to GFM checkboxes in plain body text with mtime as due', () => {
    const md = '# notes\n- [ ] first\n- [x] second'
    const tasks = extractTasks(md, 'Ideas.md', opts)
    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toMatchObject({ text: 'first', done: false, line: 1, due: '2026-07-01' })
    expect(tasks[1]).toMatchObject({ text: 'second', done: true, line: 2 })
  })

  it('prefers frontmatter due, then inline tags, and keeps raw line numbers', () => {
    const md = ['---', 'due: 2026-07-08', '---', '- [ ] inherit', '- [ ] override #today'].join('\n')
    const tasks = extractTasks(md, 'f.md', opts)
    expect(tasks[0]).toMatchObject({ text: 'inherit', due: '2026-07-08', line: 3 })
    expect(tasks[1]).toMatchObject({ text: 'override', due: '2026-07-04', line: 4 })
  })

  it('uses the filename date when the name matches YYYY-MM-DD', () => {
    const tasks = extractTasks('- [ ] daily', 'd.md', { ...opts, fileName: '2026-07-06.md' })
    expect(tasks[0].due).toBe('2026-07-06')
  })

  it('honors frontmatter status: done', () => {
    const md = ['---', 'status: done', '---', '- [ ] looks open but the note is archived'].join('\n')
    expect(extractTasks(md, 'f.md', opts)[0].done).toBe(true)
  })

  it('never matches checkbox-like lines inside frontmatter', () => {
    const md = ['---', 'note: - [ ] not a task', '---', '- [ ] real'].join('\n')
    expect(extractTasks(md, 'f.md', opts)).toHaveLength(1)
  })
})

describe('extractWikiLinks', () => {
  it('finds plain, aliased, and heading links', () => {
    const md = 'see [[Alpha]] and [[Beta|the b note]] plus [[Gamma#section]] but not [regular](links)'
    expect(extractWikiLinks(md)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })
})

describe('buildLinkGraph', () => {
  const notes = [
    { title: 'Alpha', relPath: 'Alpha.md', mtime: 1, links: ['Beta', 'Gamma', 'Ghost'] },
    { title: 'Beta', relPath: 'Beta.md', mtime: 2, links: ['alpha'] }, // case-insensitive + duplicate edge
    { title: 'Gamma', relPath: 'g/Gamma.md', mtime: 3, links: [] }
  ]
  it('builds deduplicated bidirectional edges and degree counts', () => {
    const graph = buildLinkGraph(notes)
    expect(graph.edges).toEqual([
      [0, 1],
      [0, 2]
    ])
    expect(graph.nodes.map((n) => n.links)).toEqual([2, 1, 1])
  })
  it('ignores links to notes that do not exist', () => {
    const graph = buildLinkGraph(notes)
    expect(graph.edges.flat().every((i) => i < notes.length)).toBe(true)
  })
})
