import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'

// The island must read as part of the hardware notch. The window is created
// at full (expanded) size once and never resized — expansion is a pure CSS
// animation in the renderer, so it's perfectly smooth. When collapsed the
// window ignores mouse events (with move-forwarding) so it never blocks
// clicks, and the renderer watches forwarded mousemoves to know when the
// pointer slides under the notch.

// menu-bar height ≈ physical notch height on notched MacBooks (fallback 37)
export function menuBarHeight(): number {
  const d = screen.getPrimaryDisplay()
  const h = d.workArea.y - d.bounds.y
  return h > 0 ? h : 37
}

export const NOTCH_WIDTH = 440

export function createNotchWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const m = menuBarHeight()
  const size = { width: NOTCH_WIDTH, height: m + 122 }
  const win = new BrowserWindow({
    ...size,
    x: Math.round(display.bounds.x + display.bounds.width / 2 - size.width / 2),
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
  // start dormant: clicks pass through, but moves are forwarded to the page
  win.setIgnoreMouseEvents(true, { forward: true })
  const url = `notch.html#mh=${m}`
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${url}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/notch.html'), { hash: `mh=${m}` })
  }
  ipcMain.on(IPC.notchResize, (e, expanded: boolean) => {
    if (e.sender !== win.webContents) return
    // expanded: interactive island; collapsed: ghost that forwards moves
    if (expanded) win.setIgnoreMouseEvents(false)
    else win.setIgnoreMouseEvents(true, { forward: true })
  })
  return win
}
