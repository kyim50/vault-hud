// Loading-interstitial scene transition — pure phase math. The transition
// dissolves the outgoing scene OUT to a "loading" beat (the mascot working +
// cycling dots), HOLDs the beat, then dissolves the incoming scene IN. Kept
// pure so the phase boundaries and dissolve amounts are unit-testable away
// from the canvas.

export type LoadingPhase = 'out' | 'hold' | 'in'

export interface LoadingFrame {
  phase: LoadingPhase
  // dissolve amount 0..1 within the 'out'/'in' phases (fraction of blocks
  // swapped). Always 1 during 'hold' (the loading beat fully shown).
  mix: number
}

// phase boundaries as fractions of the transition window
export const OUT_END = 0.3
export const IN_START = 0.7

export function loadingPhase(t: number): LoadingFrame {
  const clamped = Math.max(0, Math.min(1, t))
  if (clamped < OUT_END) return { phase: 'out', mix: clamped / OUT_END }
  if (clamped >= IN_START) return { phase: 'in', mix: (clamped - IN_START) / (1 - IN_START) }
  return { phase: 'hold', mix: 1 }
}
