import type { ThemeDef } from '@shared/types'

export const BUILTINS: Record<string, ThemeDef> = {
  terminal: {
    name: 'terminal',
    colors: {
      bg: '#1e1e1e',
      surface: '#1e1e1e',
      ink: '#e8e6e3',
      inkDim: '#8f8f8f',
      lineSoft: '#3a3a3a',
      accent: '#e8e6e3',
      mascotBody: '#d97757',
      mascotDark: '#b85c3f',
      mascotBodyLight: '#e8a284',
      mascotEye: '#17160f',
      mascotMuzzle: '#f4f2e9',
      danger: '#ff6e4e'
    },
    density: 'cozy'
  },
  paper: {
    name: 'paper',
    colors: {
      bg: '#f4f2e9',
      surface: '#f4f2e9',
      ink: '#17160f',
      inkDim: '#8d8a7a',
      lineSoft: '#dcd9ca',
      accent: '#17160f',
      mascotBody: '#d97757'
    },
    density: 'cozy'
  }
}
