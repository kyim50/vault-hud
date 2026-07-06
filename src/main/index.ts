import { app, BrowserWindow, ipcMain, shell, Tray } from 'electron'
import { join, resolve, sep } from 'node:path'
import { IPC } from '@shared/ipc'
import type { CustomSprite, Directive, RepoConfig, ThemeDef, VaultHudConfig } from '@shared/types'
import { loadOrCreateConfig, saveConfig, CONFIG_PATH } from './config'
import { loadSprites, saveSprite as persistSprite, deleteSprite as removeSprite } from './sprites'
import { writeTheme } from './collectors/themes'
import { HudState } from './state'
import { appendCapture, setDirectiveDone } from './collectors/vault'
import { setupTray } from './tray'
import { createNotchWindow, applyNotchBounds } from './notch'
import { resolveNotch } from '@shared/resolveNotch'

let state: HudState
let tray: Tray
let hudWin: BrowserWindow | null = null
let notchWin: BrowserWindow | null = null

function createHudWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200, height: 720, minWidth: 1000, minHeight: 600,
    backgroundColor: '#1e1e1e', title: 'vault',
    // sandbox off: electron-vite emits an ESM preload (.mjs), which sandboxed renderers can't load
    webPreferences: { preload: join(__dirname, '../preload/index.mjs'), sandbox: false, backgroundThrottling: false }
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/hud.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/hud.html'))
  }
  win.on('closed', () => {
    if (hudWin === win) hudWin = null
  })
  hudWin = win
  return win
}

// terminal-style live title: "vault — ◉ 41% · ▶ plan today"
function hudTitle(): string {
  const s = state.snapshot
  const running = s.commands.find((c) => c.status.state === 'running')
  const parts = [`vault — ◉ ${s.usage.percent}%`]
  if (running) parts.push(`▶ ${running.info.label.toLowerCase()}`)
  else if (s.directives.length > 0) {
    parts.push(`${s.directives.filter((d) => d.done).length}/${s.directives.length} directives`)
  }
  return parts.join(' · ')
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.snapshotUpdate, state.snapshot)
  }
  if (hudWin && !hudWin.isDestroyed()) hudWin.setTitle(hudTitle())
}

app.whenReady().then(async () => {
  const { config, created } = await loadOrCreateConfig()
  // In dev, commands/ lives at project root; in prod it's packaged alongside.
  const commandsDir = app.isPackaged
    ? join(process.resourcesPath, 'commands')
    : join(app.getAppPath(), 'commands')
  state = new HudState(config, commandsDir, created, CONFIG_PATH)
  state.snapshot.sprites = await loadSprites()
  state.on('snapshot', broadcast)

  ipcMain.handle(IPC.getSnapshot, () => state.snapshot)
  ipcMain.on(IPC.runCommand, (_e, id: string) => state.runner.run(id))
  ipcMain.on(IPC.toggleDirective, async (_e, d: Directive, done: boolean) => {
    try {
      await setDirectiveDone(config, d, done)
      if (done) {
        config.pet.xp += 1
        state.noteDirectiveDone()
        void saveConfig(config)
      }
      await state.refreshVault()
    } catch (e) {
      console.error('vault-hud: toggleDirective failed', e)
    }
  })
  ipcMain.on(IPC.updateConfig, async (_e, patch: { ui?: Partial<VaultHudConfig['ui']>; ai?: Partial<VaultHudConfig['ai']>; petName?: string; repos?: RepoConfig[] }) => {
    try {
      if (patch.ui) Object.assign(config.ui, patch.ui)
      if (patch.ai) Object.assign(config.ai, patch.ai)
      if (typeof patch.petName === 'string' && patch.petName.trim()) config.pet.name = patch.petName.trim().slice(0, 12)
      if (Array.isArray(patch.repos)) config.repos = patch.repos
      await saveConfig(config)
      await state.refreshAll()
      if (patch.ui?.notch && notchWin && !notchWin.isDestroyed()) {
        applyNotchBounds(notchWin, resolveNotch(config.ui.notch))
      }
    } catch (e) {
      console.error('vault-hud: updateConfig failed', e)
    }
  })
  ipcMain.on(IPC.saveSprite, async (_e, sprite: CustomSprite) => {
    try {
      state.snapshot.sprites = await persistSprite(state.snapshot.sprites, sprite)
      await state.refreshVault()
    } catch (e) {
      console.error('vault-hud: saveSprite failed', e)
    }
  })
  ipcMain.on(IPC.writeTheme, async (_e, payload: { name: string; def: ThemeDef }) => {
    try {
      await writeTheme(payload.name, payload.def)
      await state.refreshAll()
    } catch (e) {
      console.error('vault-hud: writeTheme failed', e)
    }
  })
  ipcMain.on(IPC.deleteSprite, async (_e, name: string) => {
    try {
      state.snapshot.sprites = await removeSprite(state.snapshot.sprites, name)
      await state.refreshVault()
    } catch (e) {
      console.error('vault-hud: deleteSprite failed', e)
    }
  })
  ipcMain.on(IPC.capture, async (_e, text: string) => {
    try {
      await appendCapture(config, text)
      await state.refreshVault()
    } catch (e) {
      console.error('vault-hud: capture failed', e)
    }
  })
  // app-agnostic: open the note in whatever the OS considers its default
  // editor — no vendor URL schemes (path containment enforced)
  ipcMain.on(IPC.openDoc, (_e, relPath: string) => {
    const root = resolve(config.vaultPath)
    const full = resolve(root, relPath)
    if (!full.startsWith(root + sep)) return
    void shell.openPath(full)
  })

  createHudWindow()
  const showHud = (): void => {
    if (hudWin && !hudWin.isDestroyed()) {
      hudWin.show()
      hudWin.focus()
    } else {
      createHudWindow()
    }
  }
  tray = setupTray(state, showHud)
  const nc = resolveNotch(config.ui.notch)
  if (nc.enabled) notchWin = createNotchWindow(nc)

  void state.start()

  // the notch window never closes, so window-count checks are useless here
  app.on('activate', showHud)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
