import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import type { ResolvedNotch } from '@shared/resolveNotch'

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

export function createNotchWindow(cfg: ResolvedNotch): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const m = menuBarHeight()
  // +18 hosts the multi-provider toggle bar at the island's foot
  const size = { width: cfg.width, height: m + cfg.expandedHeight }
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
  // macOS clamps the window below the menu bar at creation (the level is
  // still 'normal' then), and raising the level does NOT move it back —
  // bounds must be re-applied AFTER setAlwaysOnTop to truly hug the notch
  const pin = (): void => {
    const d = screen.getPrimaryDisplay()
    win.setBounds({
      x: Math.round(d.bounds.x + d.bounds.width / 2 - size.width / 2),
      y: d.bounds.y,
      ...size
    })
  }
  pin()
  // resolution / display changes re-clamp the window: pin it again
  screen.on('display-metrics-changed', pin)
  win.on('closed', () => screen.removeListener('display-metrics-changed', pin))
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

// re-pin the notch centered at the top with a new size — a plain resize (NOT
// the expand/collapse animation, which stays pure CSS), used for live config edits
export function applyNotchBounds(win: BrowserWindow, cfg: ResolvedNotch): void {
  const d = screen.getPrimaryDisplay()
  const width = cfg.width
  const height = menuBarHeight() + cfg.expandedHeight
  win.setBounds({ x: Math.round(d.bounds.x + d.bounds.width / 2 - width / 2), y: d.bounds.y, width, height })
}
