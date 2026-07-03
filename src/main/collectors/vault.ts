import { promises as fs } from 'node:fs'
import { join, relative } from 'node:path'
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
        const stat = await fs.stat(full)
        const rel = relative(config.vaultPath, full)
        docs.push({
          title: e.name.replace(/\.md$/, ''),
          relPath: rel,
          folder: relative(root, dir) || '.',
          mtime: stat.mtimeMs
        })
      }
    }
  }
  await walk(root)
  return docs.sort((a, b) => b.mtime - a.mtime).slice(0, 12)
}

export async function collectVaultData(config: VaultHudConfig): Promise<{
  docs: VaultDoc[]
  directives: Directive[]
  schedule: ScheduleItem[]
}> {
  if (!config.vaultPath) return { docs: [], directives: [], schedule: [] }
  const docs = await listDocs(config).catch(() => [] as VaultDoc[])

  let directives: Directive[] = []
  const planRel = join(config.dashboardFolder, 'Plans', planFileName(new Date()))
  try {
    const md = await fs.readFile(join(config.vaultPath, planRel), 'utf8')
    directives = parseDirectives(md, planRel)
  } catch {
    /* no plan today */
  }

  let schedule: ScheduleItem[] = []
  const brief = docs.find((d) => d.folder === 'Briefs')
  if (brief) {
    try {
      schedule = parseSchedule(await fs.readFile(join(config.vaultPath, brief.relPath), 'utf8'))
    } catch {
      /* fail soft */
    }
  }
  return { docs, directives, schedule }
}

export async function setDirectiveDone(
  config: VaultHudConfig,
  d: Directive,
  done: boolean
): Promise<void> {
  const full = join(config.vaultPath, d.file)
  const md = await fs.readFile(full, 'utf8')
  await fs.writeFile(full, toggleDirectiveLine(md, d.line, done))
}
