import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

function createHudWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 810,
    minWidth: 1100,
    minHeight: 640,
    backgroundColor: '#0a0c08',
    title: 'V.A.U.L.T.',
    webPreferences: { preload: join(__dirname, '../preload/index.mjs') }
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/hud.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/hud.html'))
  }
  return win
}

app.whenReady().then(() => {
  createHudWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createHudWindow()
  })
})

app.on('window-all-closed', () => {
  // keep alive for tray/notch later; quit for now
  app.quit()
})
