import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'

// The island must read as part of the hardware notch: the window floats at
// pop-up-menu level (above the menu bar), hugs y=0, and the renderer keeps
// its content below the physical notch height so the black shape and the
// notch merge into one blob.

// menu-bar height ≈ physical notch height on notched MacBooks (fallback 37)
export function menuBarHeight(): number {
  const d = screen.getPrimaryDisplay()
  const h = d.workArea.y - d.bounds.y
  return h > 0 ? h : 37
}

export function notchSizes(): { collapsed: { width: number; height: number }; expanded: { width: number; height: number } } {
  const m = menuBarHeight()
  return {
    // collapsed: an invisible hover target exactly over/under the notch
    collapsed: { width: 230, height: m + 4 },
    expanded: { width: 440, height: m + 122 }
  }
}

export function createNotchWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { collapsed } = notchSizes()
  const win = new BrowserWindow({
    ...collapsed,
    x: Math.round(display.bounds.x + display.bounds.width / 2 - collapsed.width / 2),
    y: display.bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    roundedCorners: false,
    // sandbox off: ESM preload (.mjs) requires an unsandboxed renderer
    webPreferences: { preload: join(__dirname, '../preload/index.mjs'), sandbox: false, backgroundThrottling: false }
  })
  // pop-up-menu level floats above the macOS menu bar, so the island can
  // butt up against (and visually continue) the physical notch
  win.setAlwaysOnTop(true, 'pop-up-menu', 1)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/notch.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/notch.html'))
  }
  ipcMain.on(IPC.notchResize, (e, expanded: boolean) => {
    if (e.sender !== win.webContents) return
    const { collapsed: c, expanded: x } = notchSizes()
    const size = expanded ? x : c
    const d = screen.getPrimaryDisplay()
    win.setBounds({
      x: Math.round(d.bounds.x + d.bounds.width / 2 - size.width / 2),
      y: d.bounds.y,
      ...size
    })
  })
  return win
}
