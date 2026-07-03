import { useEffect, useState } from 'react'
import type { HudSnapshot } from '@shared/types'

export function useSnapshot(): HudSnapshot | null {
  const [snapshot, setSnapshot] = useState<HudSnapshot | null>(null)
  useEffect(() => {
    let mounted = true
    void window.vault.getSnapshot().then((s) => mounted && setSnapshot(s)).catch(() => {})
    const off = window.vault.onSnapshot((s) => mounted && setSnapshot(s))
    return () => {
      mounted = false
      off()
    }
  }, [])
  return snapshot
}
