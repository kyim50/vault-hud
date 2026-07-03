import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, basename } from 'node:path'
import type { VaultHudConfig } from '@shared/types'

export function detectVaultPath(obsidianJsonContent: string): string | null {
  try {
    const data = JSON.parse(obsidianJsonContent)
    const vaults = Object.values(data.vaults ?? {}) as { path: string; open?: boolean }[]
    if (vaults.length === 0) return null
    const open = vaults.find((v) => v.open)
    return (open ?? vaults[0]).path
  } catch {
    return null
  }
}

export function buildDefaultConfig(opts: {
  home: string
  vaultPath: string | null
  repoDirs: string[]
}): VaultHudConfig {
  return {
    appName: 'V.A.U.L.T.',
    vaultPath: opts.vaultPath ?? '',
    dashboardFolder: 'Dashboard',
    repos: opts.repoDirs.map((p) => ({ name: basename(p), path: p })),
    claude: { windowHours: 5, windowTokenLimit: 2_000_000 },
    primaryDirective: {
      label: 'COMMITS THIS WEEK',
      target: 30,
      unit: 'commits',
      source: 'commitsThisWeek'
    }
  }
}

export const CONFIG_DIR = join(homedir(), '.vault-hud')
export const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

async function detectRepoDirs(home: string): Promise<string[]> {
  const desktop = join(home, 'Desktop')
  const out: string[] = []
  try {
    for (const entry of await fs.readdir(desktop, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(desktop, entry.name, '.git'))) {
        out.push(join(desktop, entry.name))
      }
    }
  } catch {
    /* fail soft */
  }
  return out.sort()
}

export async function loadOrCreateConfig(): Promise<{
  config: VaultHudConfig
  created: boolean
}> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    return { config: JSON.parse(raw) as VaultHudConfig, created: false }
  } catch {
    const home = homedir()
    let vaultPath: string | null = null
    try {
      const oj = await fs.readFile(
        join(home, 'Library/Application Support/obsidian/obsidian.json'),
        'utf8'
      )
      vaultPath = detectVaultPath(oj)
    } catch {
      /* no obsidian */
    }
    const config = buildDefaultConfig({
      home,
      vaultPath,
      repoDirs: await detectRepoDirs(home)
    })
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true })
      await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
    } catch {
      /* fail soft: boot with in-memory default even if persistence fails */
    }
    return { config, created: true }
  }
}
