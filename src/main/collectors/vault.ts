import { promises as fs } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Directive, ScheduleItem, VaultDoc, VaultHudConfig } from '@shared/types'
import { parseDirectives, parseSchedule, planFileName, toggleDirectiveLine } from './vaultNotes'

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

export async function collectVaultData(config: VaultHudConfig): Promise<{
  docs: VaultDoc[]
  skills: VaultDoc[]
  directives: Directive[]
  schedule: ScheduleItem[]
}> {
  if (!config.vaultPath) return { docs: [], skills: [], directives: [], schedule: [] }
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
  return { docs, skills, directives, schedule }
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
