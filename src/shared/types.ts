export interface RepoConfig {
  name: string
  path: string
}

export interface VaultHudConfig {
  appName: string
  vaultPath: string
  dashboardFolder: string // relative to vaultPath, e.g. "Dashboard"
  repos: RepoConfig[]
  claude: { windowHours: number; windowTokenLimit: number }
  primaryDirective: {
    label: string
    target: number
    unit: string
    source: 'commitsThisWeek' | 'manual'
    manualValue?: number
  }
}

export interface RepoStats {
  name: string
  path: string
  branch: string
  commitsToday: number
  commitsWeek: number
  dirtyFiles: number
  lastCommit: string
  daily: number[] // 7 buckets, oldest first
}

export interface ClaudeUsage {
  windowTokens: number
  percent: number
  updatedAt: number
}

export interface VaultDoc {
  title: string
  relPath: string
  folder: string
  mtime: number
}

export interface Directive {
  text: string
  done: boolean
  line: number
  file: string
}

export interface ScheduleItem {
  time: string
  text: string
}

export type CommandState = 'idle' | 'queued' | 'running' | 'done' | 'failed'

export interface CommandInfo {
  id: string
  label: string
  description: string
}

export interface CommandStatus {
  id: string
  state: CommandState
  startedAt?: number
  finishedAt?: number
  log?: string
}

export interface HudSnapshot {
  appName: string
  repos: RepoStats[]
  usage: ClaudeUsage
  docs: VaultDoc[]
  directives: Directive[]
  schedule: ScheduleItem[]
  commands: { info: CommandInfo; status: CommandStatus }[]
  primary: { label: string; value: number; target: number; unit: string }
  generatedAt: number
  configCreated: boolean
  configPath: string
}
