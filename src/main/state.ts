import { EventEmitter } from 'node:events'
import type { HudSnapshot, VaultHudConfig } from '@shared/types'
import { collectRepoStats } from './collectors/git'
import { collectClaudeUsage } from './collectors/claudeUsage'
import { collectVaultData } from './collectors/vault'
import { CommandRunner } from './commands/runner'

export class HudState extends EventEmitter {
  snapshot: HudSnapshot
  runner: CommandRunner

  constructor(
    public config: VaultHudConfig,
    commandsDir: string,
    configCreated: boolean,
    configPath: string
  ) {
    super()
    this.runner = new CommandRunner(commandsDir, config)
    this.snapshot = {
      appName: config.appName,
      repos: [], usage: { windowTokens: 0, percent: 0, updatedAt: 0 },
      docs: [], skills: [], directives: [], schedule: [], commands: [],
      primary: { label: config.primaryDirective.label, value: 0, target: config.primaryDirective.target, unit: config.primaryDirective.unit },
      pet: { ...config.pet },
      ui: { ...config.ui },
      sprites: [],
      brain: { recent: [], resurfaced: null },
      generatedAt: 0,
      configCreated,
      configPath
    }
    this.runner.on('status', () => {
      this.snapshot.commands = this.runner.list()
      this.publish()
    })
  }

  async start(): Promise<void> {
    try {
      await this.runner.load()
    } catch (e) {
      console.error('vault-hud: failed to load commands; continuing with empty command deck', e)
    }
    // vault refresh after a command finishes writing notes
    this.runner.on('status', (s) => {
      if (s.state === 'done') void this.refreshVault()
    })
    await this.refreshAll()
    setInterval(() => void this.refreshAll(), 60_000)
  }

  async refreshAll(): Promise<void> {
    const [repos, usage] = await Promise.all([
      Promise.all(this.config.repos.map(collectRepoStats)),
      collectClaudeUsage(this.config)
    ])
    this.snapshot.repos = repos
    this.snapshot.usage = usage
    this.snapshot.primary.value =
      this.config.primaryDirective.source === 'commitsThisWeek'
        ? repos.reduce((s, r) => s + r.commitsWeek, 0)
        : (this.config.primaryDirective.manualValue ?? 0)
    await this.refreshVault(false)
    this.publish()
  }

  async refreshVault(publish = true): Promise<void> {
    const { docs, skills, directives, schedule, brain } = await collectVaultData(this.config)
    this.snapshot.brain = brain
    this.snapshot.docs = docs
    this.snapshot.skills = skills
    this.snapshot.directives = directives
    this.snapshot.schedule = schedule
    if (publish) this.publish()
  }

  private publish(): void {
    this.snapshot.commands = this.runner.list()
    this.snapshot.pet = { ...this.config.pet }
    this.snapshot.ui = { ...this.config.ui }
    this.snapshot.generatedAt = Date.now()
    this.emit('snapshot', this.snapshot)
  }
}
