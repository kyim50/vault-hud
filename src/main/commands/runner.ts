import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { execFile } from 'node:child_process'
import type { CommandInfo, CommandStatus, VaultHudConfig } from '@shared/types'
import { parseCommandFile, renderPrompt } from './commandFile'
import { localDateStamp } from '../collectors/vaultNotes'

export type SpawnFn = (
  prompt: string,
  allowedTools: string,
  cwd: string
) => Promise<{ code: number; output: string }>

interface LoadedCommand {
  info: CommandInfo
  allowedTools: string
  prompt: string
  status: CommandStatus
}

export const claudeSpawn: SpawnFn = (prompt, allowedTools, cwd) =>
  new Promise((resolve) => {
    const args = ['-p', prompt, '--output-format', 'text']
    if (allowedTools) args.push('--allowedTools', allowedTools)
    execFile('claude', args, { cwd, timeout: 600_000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err ? 1 : 0, output: `${stdout}\n${stderr}`.trim() })
    })
  })

export class CommandRunner extends EventEmitter {
  private commands = new Map<string, LoadedCommand>()
  private queue: string[] = []
  private running = false

  constructor(
    private commandsDir: string,
    private config: VaultHudConfig,
    private spawnFn: SpawnFn = claudeSpawn
  ) {
    super()
  }

  async load(): Promise<void> {
    this.commands.clear()
    const files = (await fs.readdir(this.commandsDir)).filter((f) => f.endsWith('.md'))
    for (const f of files) {
      const id = basename(f, '.md')
      const raw = await fs.readFile(join(this.commandsDir, f), 'utf8')
      const parsed = parseCommandFile(raw, id)
      this.commands.set(id, { ...parsed, status: { id, state: 'idle' } })
    }
  }

  list(): { info: CommandInfo; status: CommandStatus }[] {
    return [...this.commands.values()].map((c) => ({ info: c.info, status: c.status }))
  }

  run(id: string): void {
    const cmd = this.commands.get(id)
    if (!cmd || cmd.status.state === 'queued' || cmd.status.state === 'running') return
    this.setStatus(id, { id, state: 'queued' })
    this.queue.push(id)
    void this.drain()
  }

  private setStatus(id: string, status: CommandStatus): void {
    const cmd = this.commands.get(id)
    if (!cmd) return
    cmd.status = status
    this.emit('status', status)
  }

  private vars(): Record<string, string> {
    return {
      vaultPath: this.config.vaultPath,
      dashboardFolder: this.config.dashboardFolder,
      date: localDateStamp(new Date()),
      repos: this.config.repos.map((r) => `${r.name}: ${r.path}`).join('\n')
    }
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    while (this.queue.length > 0) {
      const id = this.queue.shift()!
      const cmd = this.commands.get(id)!
      const startedAt = Date.now()
      this.setStatus(id, { id, state: 'running', startedAt })
      try {
        const prompt = renderPrompt(cmd.prompt, this.vars())
        const { code, output } = await this.spawnFn(prompt, cmd.allowedTools, homedir())
        this.setStatus(id, {
          id,
          state: code === 0 ? 'done' : 'failed',
          startedAt,
          finishedAt: Date.now(),
          log: output.slice(-4000)
        })
      } catch (e) {
        this.setStatus(id, {
          id, state: 'failed', startedAt, finishedAt: Date.now(), log: String(e)
        })
      }
    }
    this.running = false
  }
}
