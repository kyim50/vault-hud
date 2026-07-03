import type { Directive, HudSnapshot } from './types'

export const IPC = {
  getSnapshot: 'hud:getSnapshot',
  snapshotUpdate: 'hud:snapshotUpdate',
  runCommand: 'command:run',
  toggleDirective: 'directive:toggle',
  openDoc: 'doc:open',
  notchResize: 'notch:resize'
} as const

export interface VaultApi {
  getSnapshot(): Promise<HudSnapshot>
  onSnapshot(cb: (s: HudSnapshot) => void): () => void
  runCommand(id: string): void
  toggleDirective(d: Directive, done: boolean): void
  openDoc(relPath: string): void
  resizeNotch(expanded: boolean): void
}

declare global {
  interface Window {
    vault: VaultApi
  }
}
