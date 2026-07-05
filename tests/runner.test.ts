import { describe, it, expect, vi } from 'vitest'
import { buildAgentInvocation, CommandRunner } from '../src/main/commands/runner'
import { buildDefaultConfig } from '../src/main/config'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function makeCommandsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cmds-'))
  writeFileSync(join(dir, 'a.md'), '---\nlabel: A\ndescription: a\n---\nprompt a')
  writeFileSync(join(dir, 'b.md'), '---\nlabel: B\ndescription: b\n---\nprompt b')
  return dir
}

const config = buildDefaultConfig({ home: '/u', vaultPath: '/v', repoDirs: [] })

describe('buildAgentInvocation', () => {
  const ai = { windowHours: 5, windowTokenLimit: 1, ollamaModel: 'llama3.2' }
  it('routes to the active provider CLI', () => {
    expect(buildAgentInvocation({ ...ai, provider: 'anthropic' }, 'p', 'Read')).toEqual({
      bin: 'claude',
      args: ['-p', 'p', '--output-format', 'text', '--allowedTools', 'Read']
    })
    expect(buildAgentInvocation({ ...ai, provider: 'openai' }, 'p', 'Read')).toEqual({
      bin: 'codex',
      args: ['exec', 'p']
    })
    expect(buildAgentInvocation({ ...ai, provider: 'ollama' }, 'p', '')).toEqual({
      bin: 'ollama',
      args: ['run', 'llama3.2', 'p']
    })
  })
})

describe('CommandRunner', () => {
  it('loads commands and reports idle statuses', async () => {
    const runner = new CommandRunner(makeCommandsDir(), config, async () => ({ code: 0, output: '' }))
    await runner.load()
    const list = runner.list()
    expect(list.map((c) => c.info.id).sort()).toEqual(['a', 'b'])
    expect(list.every((c) => c.status.state === 'idle')).toBe(true)
  })

  it('runs one command at a time and emits status transitions', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const calls: string[] = []
    const runner = new CommandRunner(makeCommandsDir(), config, async (prompt) => {
      calls.push(prompt)
      if (calls.length === 1) await gate
      return { code: 0, output: 'ok' }
    })
    await runner.load()
    const states: string[] = []
    runner.on('status', (s) => states.push(`${s.id}:${s.state}`))

    runner.run('a')
    runner.run('b')
    await vi.waitFor(() => expect(states).toContain('b:queued'))
    expect(calls).toHaveLength(1) // b waits for a
    release()
    await vi.waitFor(() => expect(states).toContain('b:done'))
    expect(states).toContain('a:running')
    expect(states).toContain('a:done')
  })

  it('marks failed runs with log', async () => {
    const runner = new CommandRunner(makeCommandsDir(), config, async () => ({ code: 1, output: 'boom' }))
    await runner.load()
    runner.run('a')
    await vi.waitFor(() =>
      expect(runner.list().find((c) => c.info.id === 'a')!.status.state).toBe('failed')
    )
    expect(runner.list().find((c) => c.info.id === 'a')!.status.log).toContain('boom')
  })
})
