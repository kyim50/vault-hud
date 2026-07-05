import type { ReactNode } from 'react'
import type { HudSnapshot } from '@shared/types'

// A HUD module: a rendered unit (panel today) with shipped option defaults.
// The registry + config.ui.modules make every module toggleable/configurable.
export interface HudModule<Opt = Record<string, never>> {
  id: string
  defaults: Opt
  render: (snap: HudSnapshot, opts: Opt) => ReactNode
}
