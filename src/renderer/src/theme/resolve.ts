// src/renderer/src/theme/resolve.ts
import type { ThemeDef } from '@shared/types'
import { mix, lighten, darken } from './color'
import { BASE, ROLE_DEFAULTS, DENSITY_SPACING, FONT_FALLBACK, type ResolvedTheme } from './roles'

export function resolve(def: ThemeDef): ResolvedTheme {
  const c = def.colors ?? {}
  const bg = c.bg ?? BASE.bg
  const ink = c.ink ?? BASE.ink
  const accent = c.accent ?? ink
  const mascotBody = c.mascotBody ?? BASE.mascotBody
  const density = def.density ?? 'cozy'
  const stack = (name: string | undefined, fallback: string) => (name ? `'${name}', ${fallback}` : fallback)
  return {
    colors: {
      bg,
      surface: c.surface ?? bg,
      ink,
      inkDim: c.inkDim ?? mix(ink, bg, 0.45),
      line: c.line ?? ink,
      lineSoft: c.lineSoft ?? mix(ink, bg, 0.82),
      accent,
      accentDim: c.accentDim ?? mix(accent, bg, 0.45),
      mascotBody,
      mascotBodyLight: c.mascotBodyLight ?? lighten(mascotBody, 0.15),
      mascotDark: c.mascotDark ?? darken(mascotBody, 0.15),
      mascotEye: c.mascotEye ?? ROLE_DEFAULTS.mascotEye,
      mascotMuzzle: c.mascotMuzzle ?? ROLE_DEFAULTS.mascotMuzzle,
      danger: c.danger ?? ROLE_DEFAULTS.danger
    },
    fonts: { mono: stack(def.fonts?.mono, FONT_FALLBACK.mono), pixel: stack(def.fonts?.pixel, FONT_FALLBACK.pixel) },
    density,
    spacing: DENSITY_SPACING[density]
  }
}
