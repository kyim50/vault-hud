import { promises as fs } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Directive, ScheduleItem, VaultDoc, VaultHudConfig } from '@shared/types'
import { localDateStamp, parseDirectives, parseSchedule, planFileName, toggleDirectiveLine } from './vaultNotes'

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

// whole-vault note scan: shallow-ish, capped, fail-soft — powers Second Brain
async function listVaultNotes(config: VaultHudConfig): Promise<VaultDoc[]> {
  const notes: VaultDoc[] = []
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || notes.length >= 500) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (notes.length >= 500) return
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
  return notes.sort((a, b) => b.mtime - a.mtime)
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

export async function collectVaultData(config: VaultHudConfig): Promise<{
  docs: VaultDoc[]
  skills: VaultDoc[]
  directives: Directive[]
  schedule: ScheduleItem[]
  brain: { recent: VaultDoc[]; resurfaced: VaultDoc | null }
}> {
  if (!config.vaultPath) return { docs: [], skills: [], directives: [], schedule: [], brain: { recent: [], resurfaced: null } }
  const allDocs = await listDocs(config).catch(() => [] as VaultDoc[])
  const docs = allDocs.slice(0, 12)

  let directives: Directive[] = []
  const planRel = join(config.dashboardFolder, 'Plans', planFileName(new Date()))
  try {
    const md = await fs.readFile(join(config.vaultPath, planRel), 'utf8')
    directives = parseDirectives(md, planRel)
  } catch {
    /* no plan today */
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
  const notes = await listVaultNotes(config).catch(() => [] as VaultDoc[])
  const brain = {
    recent: notes.slice(0, 6),
    resurfaced: pickResurfaced(notes, localDateStamp(new Date()), Date.now())
  }
  return { docs, skills, directives, schedule, brain }
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
