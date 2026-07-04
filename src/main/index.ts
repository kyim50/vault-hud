import { app, BrowserWindow, ipcMain, shell, Tray } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import type { Directive } from '@shared/types'
import { loadOrCreateConfig, CONFIG_PATH } from './config'
import { HudState } from './state'
import { setDirectiveDone } from './collectors/vault'
import { setupTray } from './tray'
import { createNotchWindow } from './notch'

let state: HudState
let tray: Tray

function createHudWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200, height: 720, minWidth: 1000, minHeight: 600,
    backgroundColor: '#1e1e1e', title: 'VAULT',
    // sandbox off: electron-vite emits an ESM preload (.mjs), which sandboxed renderers can't load
    webPreferences: { preload: join(__dirname, '../preload/index.mjs'), sandbox: false, backgroundThrottling: false }
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
  const { config, created } = await loadOrCreateConfig()
  // In dev, commands/ lives at project root; in prod it's packaged alongside.
  const commandsDir = app.isPackaged
    ? join(process.resourcesPath, 'commands')
    : join(app.getAppPath(), 'commands')
  state = new HudState(config, commandsDir, created, CONFIG_PATH)
  state.on('snapshot', broadcast)

  ipcMain.handle(IPC.getSnapshot, () => state.snapshot)
  ipcMain.on(IPC.runCommand, (_e, id: string) => state.runner.run(id))
  ipcMain.on(IPC.toggleDirective, async (_e, d: Directive, done: boolean) => {
    try {
      await setDirectiveDone(config, d, done)
      await state.refreshVault()
    } catch (e) {
      console.error('vault-hud: toggleDirective failed', e)
    }
  })
  ipcMain.on(IPC.openDoc, (_e, relPath: string) => {
    const vaultName = config.vaultPath.split('/').pop() ?? ''
    void shell.openExternal(
      `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath.replace(/\.md$/, ''))}`
    )
  })

  createHudWindow()
  const showHud = (): void => {
    const w = BrowserWindow.getAllWindows().find((x) => x.getTitle() === 'VAULT')
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

  // the notch window never closes, so window-count checks are useless here
  app.on('activate', showHud)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
