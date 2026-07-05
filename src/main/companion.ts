import type { Mood } from '@shared/types'

// Emotional companion mechanics: the red panda reads your work rhythm.

const WINDOW = 90 * 60_000 // the burnout window
const MIN_CHURN = 5 // file modifications that count as "grinding"
const MIN_SPREAD = 45 * 60_000 // churn must span this long — bursts don't count

// Napping = the workspace keeps churning but nothing gets checked off for a
// whole window: the panda curls up to nudge you toward a break.
export function computeMood(activity: number[], lastDirectiveDone: number, now: number): Mood {
  const recent = activity.filter((t) => now - t <= WINDOW)
  if (recent.length < MIN_CHURN) return 'happy'
  const oldest = Math.min(...recent)
  if (now - oldest < MIN_SPREAD) return 'happy'
  if (now - lastDirectiveDone <= WINDOW) return 'happy'
  return 'napping'
}

// Loot table: accessory props that furnish the panda's scenes over time.
export const LOOT_TABLE = ['plant', 'hat', 'snail', 'mug', 'banner', 'lantern', 'books', 'radio'] as const
export type LootId = (typeof LOOT_TABLE)[number]

// Bigger command payloads roll better. rng ∈ [0,1) injected for testing.
export function rollLoot(payloadBytes: number, owned: string[], rng: () => number): string | null {
  const chance = Math.min(0.75, 0.2 + payloadBytes / 8000)
  if (rng() > chance) return null
  const pool = LOOT_TABLE.filter((l) => !owned.includes(l))
  if (pool.length === 0) return null
  return pool[Math.floor(rng() * pool.length)]
}
