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
    appName: 'vault',
    vaultPath: opts.vaultPath ?? '',
    dashboardFolder: 'Dashboard',
    repos: opts.repoDirs.map((p) => ({ name: basename(p), path: p })),
    ai: { provider: 'anthropic', windowHours: 5, windowTokenLimit: 2_000_000, ollamaModel: 'llama3.2' },
    primaryDirective: {
      label: 'COMMITS THIS WEEK',
      target: 30,
      unit: 'commits',
      source: 'commitsThisWeek'
    },
    pet: { name: 'pip', xp: 0 },
    loot: [],
    ui: { theme: 'terminal', parade: true, audio: { mode: 'off', volume: 40 } }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mergeConfig(partial: unknown, defaults: VaultHudConfig): VaultHudConfig {
  if (!isPlainObject(partial)) return defaults
  const p = partial as Partial<VaultHudConfig> & { claude?: { windowHours?: number; windowTokenLimit?: number } }
  // configs written before the provider matrix kept limits under a `claude`
  // key — fold it into `ai` so old installs keep their tuned limits
  const legacyAi: { windowHours?: number; windowTokenLimit?: number } = {}
  if (isPlainObject(p.claude)) {
    if (typeof p.claude.windowHours === 'number') legacyAi.windowHours = p.claude.windowHours
    if (typeof p.claude.windowTokenLimit === 'number') legacyAi.windowTokenLimit = p.claude.windowTokenLimit
  }
  const merged: VaultHudConfig = {
    ...defaults,
    ...p,
    repos: Array.isArray(p.repos) ? p.repos : defaults.repos,
    ai: { ...defaults.ai, ...legacyAi, ...(isPlainObject(p.ai) ? p.ai : {}) },
    primaryDirective: {
      ...defaults.primaryDirective,
      ...(isPlainObject(p.primaryDirective) ? p.primaryDirective : {})
    },
    pet: { ...defaults.pet, ...(isPlainObject(p.pet) ? p.pet : {}) },
    loot: Array.isArray(p.loot) ? p.loot.filter((l): l is string => typeof l === 'string') : defaults.loot,
    ui: { ...defaults.ui, ...(isPlainObject(p.ui) ? p.ui : {}) }
  }
  delete (merged as unknown as Record<string, unknown>)['claude']
  return merged
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
  // zero-config detection, best-effort: an Obsidian registry if one exists,
  // else any conventional plain-markdown folder — the engine itself is
  // app-agnostic and works over any directory of .md files
  try {
    const oj = await fs.readFile(
      join(home, 'Library/Application Support/obsidian/obsidian.json'),
      'utf8'
    )
    vaultPath = detectVaultPath(oj)
  } catch {
    /* not an obsidian user */
  }
  if (!vaultPath) {
    for (const candidate of ['Documents/Notes', 'Notes', 'notes']) {
      if (existsSync(join(home, candidate))) {
        vaultPath = join(home, candidate)
        break
      }
    }
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

export async function saveConfig(config: VaultHudConfig): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
  } catch {
    /* fail soft: persistence is best-effort */
  }
}
