import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'

export const NOTCH_COLLAPSED = { width: 220, height: 34 }
export const NOTCH_EXPANDED = { width: 430, height: 152 }

export function createNotchWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    ...NOTCH_COLLAPSED,
    x: Math.round(display.bounds.x + display.bounds.width / 2 - NOTCH_COLLAPSED.width / 2),
    y: display.bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    // sandbox off: ESM preload (.mjs) requires an unsandboxed renderer
    webPreferences: { preload: join(__dirname, '../preload/index.mjs'), sandbox: false, backgroundThrottling: false }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/notch.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/notch.html'))
  }
  ipcMain.on(IPC.notchResize, (e, expanded: boolean) => {
    if (e.sender !== win.webContents) return
    const size = expanded ? NOTCH_EXPANDED : NOTCH_COLLAPSED
    const d = screen.getPrimaryDisplay()
    win.setBounds({
      x: Math.round(d.bounds.x + d.bounds.width / 2 - size.width / 2),
      y: d.bounds.y,
      ...size
    })
  })
  return win
}
