export interface RepoConfig {
  name: string
  path: string
}

// ai provider matrix: cloud providers track token windows, ollama runs
// local and is metered by CPU load instead
export type Provider = 'anthropic' | 'openai' | 'ollama'

export interface AiConfig {
  provider: Provider
  windowHours: number
  windowTokenLimit: number
  ollamaModel: string
}

export interface VaultHudConfig {
  appName: string
  vaultPath: string // any folder of plain .md files — no app lock-in
  dashboardFolder: string // relative to vaultPath, e.g. "Dashboard"
  repos: RepoConfig[]
  ai: AiConfig
  primaryDirective: {
    label: string
    target: number
    unit: string
    source: 'commitsThisWeek' | 'manual'
    manualValue?: number
  }
  pet: { name: string; xp: number }
  loot: string[] // accessory props the panda has earned
  ui: UiConfig
}

// panel ids for the two side columns, in display order (drag to rearrange)
export interface PanelLayout {
  left: string[]
  right: string[]
}

export type AudioMode = 'off' | 'hum' | 'hiss'

export interface AudioConfig {
  mode: AudioMode
  volume: number // 0-100
}

export interface ModuleConfig {
  enabled?: boolean
  options?: Record<string, unknown>
}

export interface SceneConfig {
  rotation?: string[] // scenes that cycle, in order
  intervalSec?: number // seconds per scene
  busy?: string // scene shown while a command runs
  nap?: string // scene shown after 90min idle
}

export type Density = 'compact' | 'cozy' | 'airy'
export interface ThemeColors {
  bg?: string
  surface?: string
  ink?: string
  inkDim?: string
  line?: string
  lineSoft?: string
  accent?: string
  accentDim?: string
  mascotBody?: string
  mascotBodyLight?: string
  mascotDark?: string
  mascotEye?: string
  mascotMuzzle?: string
  danger?: string
}
export interface ThemeFonts {
  mono?: string
  pixel?: string
}
export interface ThemeDef {
  name?: string
  colors?: ThemeColors
  fonts?: ThemeFonts
  density?: Density
}

export interface UiConfig {
  theme: string // active theme name: a built-in or a user theme
  parade: boolean // critters patrol the HUD frame
  layout?: PanelLayout
  audio?: AudioConfig
  modules?: Record<string, ModuleConfig> // per-module rice slice: enable + options
  themes?: Record<string, ThemeDef> // inline user themes (folder themes merge over these)
  scenes?: SceneConfig
}

export interface CustomSprite {
  name: string
  grid: string[][] // rows of hex colors; '' = transparent
  // frame: patrols the HUD border · totem: displayed big in the Totem panel
  // (legacy 'parade' → 'frame' and 'pet' → 'totem' migrate on load)
  use: 'frame' | 'totem' | 'none'
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

// provider-aware metrics: cloud = token window, local = cpu load
export interface UsageStats {
  provider: Provider
  mode: 'tokens' | 'cpu'
  windowTokens: number
  percent: number
  cores?: number // set in cpu mode
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
  due?: string // YYYY-MM-DD when detectable (filename, inline tag, frontmatter)
}

export interface ScheduleItem {
  time: string
  text: string
}

// bi-directional wiki-link graph over the markdown workspace
export interface GraphNode {
  title: string
  relPath: string
  mtime: number
  links: number // degree — used for star brightness
}

export interface LinkGraph {
  nodes: GraphNode[]
  edges: [number, number][] // indices into nodes
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

export type Mood = 'happy' | 'napping'

export interface HudSnapshot {
  appName: string
  repos: RepoStats[]
  usage: UsageStats
  docs: VaultDoc[]
  skills: VaultDoc[]
  directives: Directive[]
  schedule: ScheduleItem[]
  commands: { info: CommandInfo; status: CommandStatus }[]
  primary: { label: string; value: number; target: number; unit: string }
  pet: { name: string; xp: number }
  mood: Mood // napping = files churning but nothing checked off in 90min
  loot: string[]
  graph: LinkGraph
  ui: UiConfig
  sprites: CustomSprite[]
  brain: { recent: VaultDoc[]; resurfaced: VaultDoc | null }
  generatedAt: number
  configCreated: boolean
  configPath: string
  bootAt: number // main-process start time — uptime source
  quotes: string[] // defaults merged with a vault Quotes.md when present
  userThemes: Record<string, ThemeDef> // config.ui.themes merged with ~/.vault-hud/themes/*.json
}
