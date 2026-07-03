import type { CommandInfo } from '@shared/types'

export function parseCommandFile(
  raw: string,
  id: string
): { info: CommandInfo; allowedTools: string; prompt: string } {
  let label = id
  let description = ''
  let allowedTools = ''
  let prompt = raw.trim()

  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^([\w-]+):\s*(.*)$/)
      if (!kv) continue
      if (kv[1] === 'label') label = kv[2].trim()
      if (kv[1] === 'description') description = kv[2].trim()
      if (kv[1] === 'allowed-tools') allowedTools = kv[2].trim()
    }
    prompt = m[2].trim()
  }
  return { info: { id, label, description }, allowedTools, prompt }
}

export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}
