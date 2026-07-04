import type { CustomSprite, Directive, HudSnapshot, RepoConfig } from './types'

export const IPC = {
  getSnapshot: 'hud:getSnapshot',
  snapshotUpdate: 'hud:snapshotUpdate',
  runCommand: 'command:run',
  toggleDirective: 'directive:toggle',
  openDoc: 'doc:open',
  notchResize: 'notch:resize',
  updateConfig: 'config:update',
  saveSprite: 'sprite:save',
  deleteSprite: 'sprite:delete',
  capture: 'vault:capture'
} as const

export interface VaultApi {
  getSnapshot(): Promise<HudSnapshot>
  onSnapshot(cb: (s: HudSnapshot) => void): () => void
  runCommand(id: string): void
  toggleDirective(d: Directive, done: boolean): void
  openDoc(relPath: string): void
  resizeNotch(expanded: boolean): void
  updateConfig(patch: { ui?: Partial<{ theme: 'terminal' | 'paper'; parade: boolean }>; petName?: string; repos?: RepoConfig[] }): void
  saveSprite(sprite: CustomSprite): void
  deleteSprite(name: string): void
  capture(text: string): void
}

declare global {
  interface Window {
    vault: VaultApi
  }
}
