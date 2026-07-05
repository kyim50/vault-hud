// src/renderer/src/theme/sceneColors.ts
import type { ResolvedTheme } from './roles'

// Live singletons the Core canvas reads every frame; updated once per theme change.
export const sceneColors = {
  ink: '#e8e6e3',
  body: '#d97757',
  bodyLight: '#e8a284',
  eye: '#17160f',
  gray: '#8f8f8f',
  dark: '#b85c3f'
}
export const scenePalette = { body: '#d97757', dark: '#b85c3f', ink: '#e8e6e3', eye: '#17160f', muzzle: '#f4f2e9' }

export function setSceneColors(t: ResolvedTheme): void {
  const c = t.colors
  sceneColors.ink = c.ink
  sceneColors.body = c.mascotBody
  sceneColors.bodyLight = c.mascotBodyLight
  sceneColors.eye = c.mascotEye
  sceneColors.gray = c.inkDim
  sceneColors.dark = c.mascotDark
  scenePalette.body = c.mascotBody
  scenePalette.dark = c.mascotDark
  scenePalette.ink = c.ink
  scenePalette.eye = c.mascotEye
  scenePalette.muzzle = c.mascotMuzzle
}
