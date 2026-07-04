import { Menu, Tray, nativeImage } from 'electron'
import type { HudState } from './state'

export function setupTray(state: HudState, showHud: () => void): Tray {
  const tray = new Tray(nativeImage.createEmpty())
  let lastFingerprint = ''
  const render = (): void => {
    tray.setTitle(`◉ ${state.snapshot.usage.percent}%`, { fontType: 'monospacedDigit' })
    const commands = state.snapshot.commands
    const fingerprint = commands.map((c) => `${c.info.id}:${c.status.state}`).join()
    if (fingerprint === lastFingerprint) return
    lastFingerprint = fingerprint
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: `Claude 5h window: ${state.snapshot.usage.percent}%`, enabled: false },
        { type: 'separator' },
        { label: 'Open HUD', click: showHud },
        {
          label: 'Run Command',
          submenu: commands.map((c) => ({
            label: `${c.info.label}${c.status.state === 'running' ? ' ▶' : c.status.state === 'failed' ? ' ✕' : ''}`,
            enabled: c.status.state !== 'running' && c.status.state !== 'queued',
            click: () => state.runner.run(c.info.id)
          }))
        },
        { type: 'separator' },
        { label: 'Quit VAULT', role: 'quit' }
      ])
    )
  }
  render()
  state.on('snapshot', render)
  return tray
}
