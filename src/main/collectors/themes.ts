import { promises as fs } from 'node:fs'
import { join, parse } from 'node:path'
import type { ThemeDef, VaultHudConfig } from '@shared/types'
import { CONFIG_DIR } from '../config'

export function themesDir(): string {
  return join(CONFIG_DIR, 'themes')
}

// editable starter files written on first run — never overwritten afterward
export const EXAMPLE_THEMES: Record<string, string> = {
  'midnight.json': JSON.stringify(
    { name: 'midnight', colors: { bg: '#0d0f14', surface: '#12151c', ink: '#c8d0e0', accent: '#6ea8ff', mascotBody: '#d97757' }, density: 'cozy' },
    null,
    2
  ),
  'amber.json': JSON.stringify(
    { name: 'amber', colors: { bg: '#0f0b02', ink: '#ffb000', accent: '#ffcf4d', mascotBody: '#ffb000', mascotEye: '#0f0b02' }, density: 'cozy' },
    null,
    2
  )
}

// pure: file text → ThemeDef (or null when unusable). name falls back to file stem.
export function parseThemeDef(name: string, text: string): ThemeDef | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const def = parsed as ThemeDef
  return { ...def, name: typeof def.name === 'string' && def.name.trim() ? def.name : name }
}

// write a user theme to its folder file — the authoritative source (folder
// wins over inline), so in-app theme edits must land here. `name` is sanitized
// to a bare stem to keep the write inside the themes folder (no path traversal).
export async function writeTheme(name: string, def: ThemeDef): Promise<void> {
  const stem = String(name).replace(/[^a-z0-9_-]/gi, '').slice(0, 32)
  if (!stem) return
  const dir = themesDir()
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(join(dir, `${stem}.json`), JSON.stringify({ ...def, name: def.name ?? stem }, null, 2))
}

// pure: folder themes win over inline themes of the same key
export function mergeThemes(
  inline: Record<string, ThemeDef> | undefined,
  folder: Record<string, ThemeDef>
): Record<string, ThemeDef> {
  return { ...(inline ?? {}), ...folder }
}

// scaffold the folder with examples on first run, then read every *.json (fail-soft)
export async function collectThemes(config: VaultHudConfig): Promise<Record<string, ThemeDef>> {
  const dir = themesDir()
  try {
    await fs.access(dir)
  } catch {
    try {
      await fs.mkdir(dir, { recursive: true })
      for (const [file, body] of Object.entries(EXAMPLE_THEMES)) {
        await fs.writeFile(join(dir, file), body)
      }
    } catch {
      /* fail soft: no folder → inline/builtins only */
    }
  }
  const folder: Record<string, ThemeDef> = {}
  try {
    for (const entry of await fs.readdir(dir)) {
      if (!entry.endsWith('.json')) continue
      try {
        const text = await fs.readFile(join(dir, entry), 'utf8')
        const def = parseThemeDef(parse(entry).name, text)
        if (def) folder[def.name as string] = def
      } catch {
        /* skip unreadable file */
      }
    }
  } catch {
    /* folder missing/unreadable → none */
  }
  return mergeThemes(config.ui.themes, folder)
}
