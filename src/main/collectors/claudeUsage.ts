import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ClaudeUsage, VaultHudConfig } from '@shared/types'

export function parseJsonlUsage(content: string): { ts: number; tokens: number }[] {
  const out: { ts: number; tokens: number }[] = []
  for (const raw of content.split('\n')) {
    if (!raw.trim()) continue
    try {
      const j = JSON.parse(raw)
      const u = j?.message?.usage
      const ts = Date.parse(j?.timestamp)
      if (!u || Number.isNaN(ts)) continue
      const tokens =
        (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
      if (tokens > 0) out.push({ ts, tokens })
    } catch {
      /* skip bad line */
    }
  }
  return out
}

export function computeWindowUsage(
  entries: { ts: number; tokens: number }[],
  now: number,
  windowMs: number,
  limit: number
): ClaudeUsage {
  const from = now - windowMs
  const windowTokens = entries.filter((e) => e.ts >= from && e.ts <= now).reduce((s, e) => s + e.tokens, 0)
  const percent = limit > 0 ? Math.min(100, Math.round((windowTokens / limit) * 100)) : 0
  return { windowTokens, percent, updatedAt: now }
}

export async function collectClaudeUsage(config: VaultHudConfig): Promise<ClaudeUsage> {
  const now = Date.now()
  const windowMs = config.claude.windowHours * 3_600_000
  const projectsDir = join(homedir(), '.claude', 'projects')
  const entries: { ts: number; tokens: number }[] = []
  try {
    const projects = await fs.readdir(projectsDir, { withFileTypes: true })
    for (const p of projects) {
      if (!p.isDirectory()) continue
      const dir = join(projectsDir, p.name)
      let files: string[]
      try {
        files = (await fs.readdir(dir)).filter((f) => f.endsWith('.jsonl'))
      } catch {
        continue
      }
      for (const f of files) {
        const full = join(dir, f)
        try {
          const stat = await fs.stat(full)
          // only files touched within window+1h are relevant
          if (now - stat.mtimeMs > windowMs + 3_600_000) continue
          entries.push(...parseJsonlUsage(await fs.readFile(full, 'utf8')))
        } catch {
          /* fail soft per file */
        }
      }
    }
  } catch {
    /* no ~/.claude — fail soft */
  }
  return computeWindowUsage(entries, now, windowMs, config.claude.windowTokenLimit)
}
