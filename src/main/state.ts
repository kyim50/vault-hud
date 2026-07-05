import { EventEmitter } from 'node:events'
import { watch, type FSWatcher } from 'node:fs'
import type { HudSnapshot, VaultHudConfig } from '@shared/types'
import { collectRepoStats } from './collectors/git'
import { collectUsage } from './collectors/usage'
import { collectVaultData } from './collectors/vault'
import { computeMood, rollLoot } from './companion'
import { saveConfig } from './config'
import { CommandRunner } from './commands/runner'

export class HudState extends EventEmitter {
  snapshot: HudSnapshot
  runner: CommandRunner
  // companion signals: workspace churn vs. directives actually checked off
  private vaultActivity: number[] = []
  private lastDirectiveDone = Date.now()
  private watcher: FSWatcher | null = null

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
      repos: [],
      usage: { provider: config.ai.provider, mode: 'tokens', windowTokens: 0, percent: 0, updatedAt: 0 },
      docs: [], skills: [], directives: [], schedule: [], commands: [],
      primary: { label: config.primaryDirective.label, value: 0, target: config.primaryDirective.target, unit: config.primaryDirective.unit },
      pet: { ...config.pet },
      mood: 'happy',
      loot: [...config.loot],
      graph: { nodes: [], edges: [] },
      ui: { ...config.ui },
      sprites: [],
      brain: { recent: [], resurfaced: null },
      generatedAt: 0,
      configCreated,
      configPath
    }
    this.runner.on('status', (s) => {
      this.snapshot.commands = this.runner.list()
      // a finished run may drop loot: payload size drives the roll
      if (s.state === 'done') this.maybeDropLoot(s.log?.length ?? 0)
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
    this.startWatcher()
    await this.refreshAll()
    setInterval(() => void this.refreshAll(), 60_000)
  }

  // live workspace watcher over any plain-markdown folder — refreshes the
  // vault panels on change and feeds the companion's churn signal
  private startWatcher(): void {
    if (!this.config.vaultPath) return
    let debounce: NodeJS.Timeout | null = null
    try {
      this.watcher = watch(this.config.vaultPath, { recursive: true }, (_event, filename) => {
        if (filename && !String(filename).endsWith('.md')) return
        const now = Date.now()
        this.vaultActivity.push(now)
        this.vaultActivity = this.vaultActivity.filter((t) => now - t < 2 * 90 * 60_000)
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => void this.refreshVault(), 800)
      })
      this.watcher.on('error', () => {
        /* watcher died (folder moved?) — the 60s poll still covers us */
      })
    } catch {
      /* fail soft: polling remains */
    }
  }

  noteDirectiveDone(): void {
    this.lastDirectiveDone = Date.now()
  }

  private maybeDropLoot(payloadBytes: number): void {
    const drop = rollLoot(payloadBytes, this.config.loot, Math.random)
    if (!drop) return
    this.config.loot.push(drop)
    void saveConfig(this.config)
  }

  async refreshAll(): Promise<void> {
    const [repos, usage] = await Promise.all([
      Promise.all(this.config.repos.map(collectRepoStats)),
      collectUsage(this.config)
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
    const { docs, skills, directives, schedule, brain, graph } = await collectVaultData(this.config)
    this.snapshot.brain = brain
    this.snapshot.docs = docs
    this.snapshot.skills = skills
    this.snapshot.directives = directives
    this.snapshot.schedule = schedule
    this.snapshot.graph = graph
    if (publish) this.publish()
  }

  private publish(): void {
    this.snapshot.commands = this.runner.list()
    this.snapshot.pet = { ...this.config.pet }
    this.snapshot.loot = [...this.config.loot]
    this.snapshot.mood = computeMood(this.vaultActivity, this.lastDirectiveDone, Date.now())
    this.snapshot.ui = { ...this.config.ui }
    this.snapshot.generatedAt = Date.now()
    this.emit('snapshot', this.snapshot)
  }
}
