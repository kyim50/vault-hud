import { promises as fs } from 'node:fs'
import { cpus, homedir, loadavg } from 'node:os'
import { join } from 'node:path'
import type { Provider, UsageStats, VaultHudConfig } from '@shared/types'

// Provider-agnostic usage metering. Cloud providers write session JSONL
// somewhere under $HOME (~/.claude for the Anthropic CLI, ~/.codex for the
// OpenAI CLI); we sweep whichever matches the active provider and sum the
// token window. Local ollama has no token meter — it gets CPU load instead.

// find token counts in a session line regardless of the CLI's exact shape:
// walk shallow nesting for the first object carrying input/output_tokens
function findUsage(obj: unknown, depth = 0): { input: number; output: number; cache: number } | null {
  if (!obj || typeof obj !== 'object' || depth > 4) return null
  const o = obj as Record<string, unknown>
  const input = o['input_tokens']
  const output = o['output_tokens']
  if (typeof input === 'number' || typeof output === 'number') {
    return {
      input: typeof input === 'number' ? input : 0,
      output: typeof output === 'number' ? output : 0,
      cache: typeof o['cache_creation_input_tokens'] === 'number' ? (o['cache_creation_input_tokens'] as number) : 0
    }
  }
  for (const v of Object.values(o)) {
    const found = findUsage(v, depth + 1)
    if (found) return found
  }
  return null
}

function findTimestamp(obj: unknown): number {
  const o = obj as Record<string, unknown>
  for (const key of ['timestamp', 'ts', 'created_at', 'createdAt']) {
    const v = o?.[key]
    if (typeof v === 'string') {
      const t = Date.parse(v)
      if (!Number.isNaN(t)) return t
    }
    if (typeof v === 'number' && v > 1_000_000_000) return v < 1e12 ? v * 1000 : v
  }
  return NaN
}

export function parseJsonlUsage(content: string): { ts: number; tokens: number }[] {
  const out: { ts: number; tokens: number }[] = []
  for (const raw of content.split('\n')) {
    if (!raw.trim() || !raw.includes('_tokens')) continue
    try {
      const j = JSON.parse(raw)
      const u = findUsage(j)
      const ts = findTimestamp(j)
      if (!u || Number.isNaN(ts)) continue
      const tokens = u.input + u.output + u.cache
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
  limit: number,
  provider: Provider
): UsageStats {
  const from = now - windowMs
  const windowTokens = entries.filter((e) => e.ts >= from && e.ts <= now).reduce((s, e) => s + e.tokens, 0)
  const percent = limit > 0 ? Math.min(100, Math.round((windowTokens / limit) * 100)) : 0
  return { provider, mode: 'tokens', windowTokens, percent, updatedAt: now }
}

// sweep a session directory tree (depth ≤ 3) for recently-touched .jsonl
async function sweepJsonl(root: string, now: number, windowMs: number): Promise<{ ts: number; tokens: number }[]> {
  const entries: { ts: number; tokens: number }[] = []
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 3) return
    let items
    try {
      items = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const it of items) {
      const full = join(dir, it.name)
      if (it.isDirectory()) await walk(full, depth + 1)
      else if (it.name.endsWith('.jsonl')) {
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
  }
  await walk(root, 0)
  return entries
}

const SESSION_DIRS: Record<Exclude<Provider, 'ollama'>, string[]> = {
  anthropic: ['.claude/projects'],
  openai: ['.codex/sessions', '.codex/projects']
}

export function computeCpuUsage(load1: number, coreCount: number, now: number): UsageStats {
  const percent = coreCount > 0 ? Math.min(100, Math.round((load1 / coreCount) * 100)) : 0
  return { provider: 'ollama', mode: 'cpu', windowTokens: 0, percent, cores: coreCount, updatedAt: now }
}

export async function collectUsage(config: VaultHudConfig): Promise<UsageStats> {
  const now = Date.now()
  const provider = config.ai.provider
  if (provider === 'ollama') {
    return computeCpuUsage(loadavg()[0], cpus().length, now)
  }
  const windowMs = config.ai.windowHours * 3_600_000
  const entries: { ts: number; tokens: number }[] = []
  for (const rel of SESSION_DIRS[provider]) {
    entries.push(...(await sweepJsonl(join(homedir(), rel), now, windowMs)))
  }
  return computeWindowUsage(entries, now, windowMs, config.ai.windowTokenLimit, provider)
}
