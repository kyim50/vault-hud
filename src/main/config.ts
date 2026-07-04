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
    appName: 'VAULT',
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mergeConfig(partial: unknown, defaults: VaultHudConfig): VaultHudConfig {
  if (!isPlainObject(partial)) return defaults
  const p = partial as Partial<VaultHudConfig>
  return {
    ...defaults,
    ...p,
    repos: Array.isArray(p.repos) ? p.repos : defaults.repos,
    claude: { ...defaults.claude, ...(isPlainObject(p.claude) ? p.claude : {}) },
    primaryDirective: {
      ...defaults.primaryDirective,
      ...(isPlainObject(p.primaryDirective) ? p.primaryDirective : {})
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

async function detectDefaults(): Promise<VaultHudConfig> {
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
  return buildDefaultConfig({
    home,
    vaultPath,
    repoDirs: await detectRepoDirs(home)
  })
}

export async function loadOrCreateConfig(): Promise<{
  config: VaultHudConfig
  created: boolean
}> {
  let raw: string
  try {
    raw = await fs.readFile(CONFIG_PATH, 'utf8')
  } catch {
    // file missing (or unreadable): create fresh defaults on disk
    const config = await detectDefaults()
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true })
      await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
    } catch {
      /* fail soft: boot with in-memory default even if persistence fails */
    }
    return { config, created: true }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // file exists but is corrupt: do NOT overwrite the user's file — boot
    // with in-memory defaults instead so a hand-edit typo isn't destructive.
    console.error('vault-hud: config.json is invalid JSON; using defaults in memory')
    return { config: await detectDefaults(), created: false }
  }

  const config = mergeConfig(parsed, await detectDefaults())
  return { config, created: false }
}
