// src/renderer/src/theme/roles.ts
import type { Density } from '@shared/types'

export interface ResolvedColors {
  bg: string
  surface: string
  ink: string
  inkDim: string
  line: string
  lineSoft: string
  accent: string
  accentDim: string
  mascotBody: string
  mascotBodyLight: string
  mascotDark: string
  mascotEye: string
  mascotMuzzle: string
  danger: string
}
export interface ResolvedTheme {
  colors: ResolvedColors
  fonts: { mono: string; pixel: string }
  density: Density
  spacing: { padX: number; padY: number; gap: number }
}

// terminal-theme values are the ultimate fallback when even core roles are omitted
export const BASE = { bg: '#1e1e1e', ink: '#e8e6e3', mascotBody: '#d97757' }
export const ROLE_DEFAULTS = { mascotEye: '#17160f', mascotMuzzle: '#f4f2e9', danger: '#ff6e4e' }
export const DENSITY_SPACING: Record<Density, { padX: number; padY: number; gap: number }> = {
  compact: { padX: 8, padY: 6, gap: 3 },
  cozy: { padX: 10, padY: 8, gap: 5 },
  airy: { padX: 14, padY: 12, gap: 8 }
}
export const FONT_FALLBACK = {
  mono: "'Departure Mono', 'SF Mono', Menlo, monospace",
  pixel: "'Press Start 2P', monospace"
}
