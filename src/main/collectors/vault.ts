import { promises as fs } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'
import type { Directive, LinkGraph, ScheduleItem, VaultDoc, VaultHudConfig } from '@shared/types'
import { localDateStamp, parseDirectives, parseSchedule, planFileName, toggleDirectiveLine } from './vaultNotes'
import { buildLinkGraph, extractTasks, extractWikiLinks, type ScannedNote } from './markdown'

function dashboardDir(config: VaultHudConfig): string {
  return join(config.vaultPath, config.dashboardFolder)
}

async function listDocs(config: VaultHudConfig): Promise<VaultDoc[]> {
  const root = dashboardDir(config)
  const docs: VaultDoc[] = []
  async function walk(dir: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.name.endsWith('.md')) {
        try {
          const stat = await fs.stat(full)
          const rel = relative(config.vaultPath, full)
          docs.push({
            title: e.name.replace(/\.md$/, ''),
            relPath: rel,
            folder: relative(root, dir) || '.',
            mtime: stat.mtimeMs
          })
        } catch {
          continue
        }
      }
    }
  }
  await walk(root)
  return docs.sort((a, b) => b.mtime - a.mtime)
}

async function listSkills(config: VaultHudConfig): Promise<VaultDoc[]> {
  const dir = join(config.vaultPath, 'Skills')
  const out: VaultDoc[] = []
  try {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith('.md')) continue
      try {
        const stat = await fs.stat(join(dir, e.name))
        out.push({ title: e.name.replace(/\.md$/, ''), relPath: join('Skills', e.name), folder: 'Skills', mtime: stat.mtimeMs })
      } catch { /* skip file */ }
    }
  } catch { /* no Skills yet */ }
  return out.sort((a, b) => b.mtime - a.mtime)
}

const SKIP_DIRS = new Set(['.obsidian', '.trash', 'node_modules', '.git'])
const MAX_NOTES = 500
const MAX_CONTENT_READS = 300
const MAX_FILE_BYTES = 128 * 1024

interface WorkspaceScan {
  notes: VaultDoc[]
  graph: LinkGraph
  tasks: Directive[]
}

// whole-workspace scan over any folder of plain .md files: recent notes for
// Second Brain, GFM tasks with natural deadlines, and the wiki-link graph.
// Shallow-ish, capped, fail-soft — no app-specific format required.
async function scanWorkspace(config: VaultHudConfig): Promise<WorkspaceScan> {
  const notes: VaultDoc[] = []
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || notes.length >= MAX_NOTES) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (notes.length >= MAX_NOTES) return
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await walk(full, depth + 1)
      } else if (e.name.endsWith('.md')) {
        try {
          const stat = await fs.stat(full)
          notes.push({
            title: e.name.replace(/\.md$/, ''),
            relPath: relative(config.vaultPath, full),
            folder: relative(config.vaultPath, dir) || '.',
            mtime: stat.mtimeMs
          })
        } catch {
          continue
        }
      }
    }
  }
  await walk(config.vaultPath, 0)
  notes.sort((a, b) => b.mtime - a.mtime)

  // read contents newest-first (capped) for links + tasks
  const scanned: ScannedNote[] = []
  const tasks: Directive[] = []
  const today = localDateStamp(new Date())
  for (const n of notes.slice(0, MAX_CONTENT_READS)) {
    try {
      const full = join(config.vaultPath, n.relPath)
      const stat = await fs.stat(full)
      if (stat.size > MAX_FILE_BYTES) {
        scanned.push({ title: n.title, relPath: n.relPath, mtime: n.mtime, links: [] })
        continue
      }
      const md = await fs.readFile(full, 'utf8')
      scanned.push({ title: n.title, relPath: n.relPath, mtime: n.mtime, links: extractWikiLinks(md) })
      tasks.push(...extractTasks(md, n.relPath, { fileName: basename(n.relPath), mtime: n.mtime, today }))
    } catch {
      /* fail soft per file */
    }
  }
  return { notes, graph: buildLinkGraph(scanned), tasks }
}

// deterministic daily pick from notes untouched for 14+ days
export function pickResurfaced(notes: VaultDoc[], dateStamp: string, now: number): VaultDoc | null {
  const old = notes.filter((n) => now - n.mtime > 14 * 86_400_000)
  if (old.length === 0) return null
  let h = 0
  for (const ch of dateStamp) h = (h * 31 + ch.charCodeAt(0)) | 0
  return old[Math.abs(h) % old.length]
}

export async function appendCapture(config: VaultHudConfig, text: string): Promise<void> {
  const clean = text.trim().slice(0, 500)
  if (!clean || !config.vaultPath) return
  const file = join(config.vaultPath, 'Inbox.md')
  const hh = String(new Date().getHours()).padStart(2, '0')
  const mm = String(new Date().getMinutes()).padStart(2, '0')
  const line = `- ${localDateStamp(new Date())} ${hh}:${mm} — ${clean}\n`
  try {
    await fs.appendFile(file, line)
  } catch {
    /* fail soft */
  }
}

// with no dedicated plan file, surface workspace tasks that matter today:
// anything due today or overdue, open ones first, freshest files first
export function fallbackDirectives(tasks: Directive[], today: string, cap = 14): Directive[] {
  const relevant = tasks.filter((t) => t.due && t.due <= today)
  relevant.sort((a, b) => Number(a.done) - Number(b.done) || (b.due ?? '').localeCompare(a.due ?? ''))
  return relevant.slice(0, cap)
}

export async function collectVaultData(config: VaultHudConfig): Promise<{
  docs: VaultDoc[]
  skills: VaultDoc[]
  directives: Directive[]
  schedule: ScheduleItem[]
  brain: { recent: VaultDoc[]; resurfaced: VaultDoc | null }
  graph: LinkGraph
}> {
  if (!config.vaultPath)
    return { docs: [], skills: [], directives: [], schedule: [], brain: { recent: [], resurfaced: null }, graph: { nodes: [], edges: [] } }
  const allDocs = await listDocs(config).catch(() => [] as VaultDoc[])
  const docs = allDocs.slice(0, 12)
  const scan = await scanWorkspace(config).catch(() => ({ notes: [] as VaultDoc[], graph: { nodes: [], edges: [] } as LinkGraph, tasks: [] as Directive[] }))

  // a dated plan file wins when present; otherwise fall back to natural
  // GFM tasks found anywhere in the workspace — zero required format
  let directives: Directive[] = []
  const planRel = join(config.dashboardFolder, 'Plans', planFileName(new Date()))
  try {
    const md = await fs.readFile(join(config.vaultPath, planRel), 'utf8')
    directives = parseDirectives(md, planRel)
  } catch {
    directives = fallbackDirectives(scan.tasks, localDateStamp(new Date()))
  }

  let schedule: ScheduleItem[] = []
  const brief = allDocs.find((d) => d.folder === 'Briefs')
  if (brief) {
    try {
      schedule = parseSchedule(await fs.readFile(join(config.vaultPath, brief.relPath), 'utf8'))
    } catch {
      /* fail soft */
    }
  }
  const skills = await listSkills(config)
  const brain = {
    recent: scan.notes.slice(0, 6),
    resurfaced: pickResurfaced(scan.notes, localDateStamp(new Date()), Date.now())
  }
  return { docs, skills, directives, schedule, brain, graph: scan.graph }
}

export async function setDirectiveDone(
  config: VaultHudConfig,
  d: Directive,
  done: boolean
): Promise<void> {
  const vaultRoot = resolve(config.vaultPath)
  const full = resolve(vaultRoot, d.file)
  if (!full.startsWith(vaultRoot + sep)) return
  const md = await fs.readFile(full, 'utf8')
  await fs.writeFile(full, toggleDirectiveLine(md, d.line, done))
}
