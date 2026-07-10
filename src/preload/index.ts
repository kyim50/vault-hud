import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { CustomSprite, Directive, HudSnapshot, ThemeDef } from '@shared/types'

contextBridge.exposeInMainWorld('vault', {
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot),
  onSnapshot: (cb: (s: HudSnapshot) => void) => {
    const handler = (_e: unknown, s: HudSnapshot): void => cb(s)
    ipcRenderer.on(IPC.snapshotUpdate, handler)
    return () => ipcRenderer.removeListener(IPC.snapshotUpdate, handler)
  },
  runCommand: (id: string) => ipcRenderer.send(IPC.runCommand, id),
  toggleDirective: (d: Directive, done: boolean) => ipcRenderer.send(IPC.toggleDirective, d, done),
  openDoc: (relPath: string) => ipcRenderer.send(IPC.openDoc, relPath),
  resizeNotch: (expanded: boolean) => ipcRenderer.send(IPC.notchResize, expanded),
  updateConfig: (patch: unknown) => ipcRenderer.send(IPC.updateConfig, patch),
  resetRice: () => ipcRenderer.send(IPC.resetRice),
  saveSprite: (sprite: CustomSprite) => ipcRenderer.send(IPC.saveSprite, sprite),
  deleteSprite: (name: string) => ipcRenderer.send(IPC.deleteSprite, name),
  writeTheme: (name: string, def: ThemeDef) => ipcRenderer.send(IPC.writeTheme, { name, def }),
  capture: (text: string) => ipcRenderer.send(IPC.capture, text)
})
