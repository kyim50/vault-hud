import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { VaultHudConfig } from '@shared/types'

// shipped defaults — the panel is never empty
export const DEFAULT_QUOTES: string[] = [
  'the vault is quiet today.',
  'small steps compound.',
  'ship it, then tend it.',
  'the map is not the territory.',
  'make it work, make it right, make it fast.',
  'a clear head is a fast head.',
  'delete more than you add.',
  'the best code is no code.',
  'progress, not perfection.',
  'read the error message.',
  'name things for what they do.',
  'sleep is a feature.',
  'touch grass, then touch code.',
  'the panda is watching.',
  'commit early, commit often.',
  'done is a decision.',
  'one thing at a time.',
  'the terminal remembers.'
]

// pure: markdown/plain text -> quote lines (list items or non-empty lines),
// wrapping quotes stripped, headings/blank lines ignored
export function parseQuotes(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map((l) => l.replace(/^[-*]\s+/, ''))
    .map((l) => l.replace(/^["']|["']$/g, '').trim())
    .filter((l) => l.length > 0)
}

// pure: vault file text (or null) merged with defaults, vault-first, deduped
export function mergeQuotes(vaultText: string | null): string[] {
  const vault = vaultText ? parseQuotes(vaultText) : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of [...vault, ...DEFAULT_QUOTES]) {
    if (seen.has(q)) continue
    seen.add(q)
    out.push(q)
  }
  return out
}

// fs read of Quotes.md (vault root, then dashboard folder); fail-soft to defaults
export async function collectQuotes(config: VaultHudConfig): Promise<string[]> {
  if (!config.vaultPath) return mergeQuotes(null)
  for (const p of [join(config.vaultPath, 'Quotes.md'), join(config.vaultPath, config.dashboardFolder, 'Quotes.md')]) {
    try {
      const text = await fs.readFile(p, 'utf8')
      return mergeQuotes(text)
    } catch {
      /* try next / fall through to defaults */
    }
  }
  return mergeQuotes(null)
}
