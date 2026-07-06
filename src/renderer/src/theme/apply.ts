// src/renderer/src/theme/apply.ts
import type { ResolvedTheme } from './roles'

let active: ResolvedTheme | null = null
export function getActiveTheme(): ResolvedTheme | null {
  return active
}

// Inline custom properties on <html> override the :root defaults in theme.css.
export function applyTheme(t: ResolvedTheme): void {
  active = t
  const s = document.documentElement.style
  const c = t.colors
  s.setProperty('--bg', c.bg)
  s.setProperty('--panel', c.surface)
  s.setProperty('--line', c.line)
  s.setProperty('--line-soft', c.lineSoft)
  s.setProperty('--ink', c.ink)
  s.setProperty('--ink-dim', c.inkDim)
  s.setProperty('--accent', c.accent)
  s.setProperty('--accent-dim', c.accentDim)
  s.setProperty('--clay', c.mascotBody)
  s.setProperty('--danger', c.danger)
  s.setProperty('--font-mono', t.fonts.mono)
  s.setProperty('--font-pixel', t.fonts.pixel)
  s.setProperty('--pad-x', `${t.spacing.padX}px`)
  s.setProperty('--pad-y', `${t.spacing.padY}px`)
  s.setProperty('--gap', `${t.spacing.gap}px`)
}
