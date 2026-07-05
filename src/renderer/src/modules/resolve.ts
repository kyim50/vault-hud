import type { ModuleConfig } from '@shared/types'

// Merge a module's shipped defaults with the user's rice slice.
export function resolveModule<T>(defaults: T, cfg?: ModuleConfig): { enabled: boolean; options: T } {
  return {
    enabled: cfg?.enabled !== false,
    options: { ...defaults, ...((cfg?.options ?? {}) as Partial<T>) } as T
  }
}
