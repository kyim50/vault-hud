import { app, BrowserWindow, ipcMain, shell, Tray } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import type { Directive } from '@shared/types'
import { loadOrCreateConfig } from './config'
import { HudState } from './state'
import { setDirectiveDone } from './collectors/vault'
import { setupTray } from './tray'
import { createNotchWindow } from './notch'

let state: HudState
let tray: Tray

function createHudWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440, height: 810, minWidth: 1100, minHeight: 640,
    backgroundColor: '#0a0c08', title: 'V.A.U.L.T.',
    webPreferences: { preload: join(__dirname, '../preload/index.mjs') }
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/hud.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/hud.html'))
  }
  return win
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.snapshotUpdate, state.snapshot)
  }
}

app.whenReady().then(async () => {
  const { config } = await loadOrCreateConfig()
  // In dev, commands/ lives at project root; in prod it's packaged alongside.
  const commandsDir = app.isPackaged
    ? join(process.resourcesPath, 'commands')
    : join(app.getAppPath(), 'commands')
  state = new HudState(config, commandsDir)
  state.on('snapshot', broadcast)

  ipcMain.handle(IPC.getSnapshot, () => state.snapshot)
  ipcMain.on(IPC.runCommand, (_e, id: string) => state.runner.run(id))
  ipcMain.on(IPC.toggleDirective, async (_e, d: Directive, done: boolean) => {
    try {
      await setDirectiveDone(config, d, done)
      await state.refreshVault()
    } catch { /* fail soft */ }
  })
  ipcMain.on(IPC.openDoc, (_e, relPath: string) => {
    const vaultName = config.vaultPath.split('/').pop() ?? ''
    void shell.openExternal(
      `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath.replace(/\.md$/, ''))}`
    )
  })

  const hudWin = createHudWindow()
  const showHud = (): void => {
    const w = BrowserWindow.getAllWindows().find((x) => x.getTitle() === 'V.A.U.L.T.')
    if (w && !w.isDestroyed()) {
      w.show()
      w.focus()
    } else {
      createHudWindow()
    }
  }
  tray = setupTray(state, showHud)
  createNotchWindow()

  void state.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createHudWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
