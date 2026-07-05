import type { ReactNode } from 'react'
import type { HudSnapshot } from '@shared/types'

// Extra per-render state that a few modules (the Core) need but most ignore.
export interface RenderContext {
  chart: boolean
  setChart: (fn: (c: boolean) => boolean) => void
  coreMax: number
}

// A HUD module: a rendered unit (panel) with shipped option defaults.
// The registry + config.ui.modules make every module toggleable/configurable.
export interface HudModule<Opt = Record<string, never>> {
  id: string
  defaults: Opt
  render: (snap: HudSnapshot, opts: Opt, ctx: RenderContext) => ReactNode
}
