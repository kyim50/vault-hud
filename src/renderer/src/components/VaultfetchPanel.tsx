import { Fragment, useEffect, useState } from 'react'
import type { HudSnapshot } from '@shared/types'
import { Panel } from './Panel'
import { PANDA, DEFAULT_PALETTE } from '../lib/panda'
import { spriteToHalfBlocks } from '../lib/blockart'
import { fetchLines, type FetchLineId } from '../lib/fetchLines'

export interface FetchOptions {
  lines: FetchLineId[]
  showLogo: boolean
  showSwatches: boolean
  quoteRotateSec: number // 0 = static
}

export const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  lines: ['uptime', 'repos', 'tokens', 'commits', 'provider', 'streak', 'mood'],
  showLogo: true,
  showSwatches: true,
  quoteRotateSec: 20
}

const SWATCHES = [
  DEFAULT_PALETTE.body,
  DEFAULT_PALETTE.dark,
  DEFAULT_PALETTE.muzzle,
  DEFAULT_PALETTE.eye,
  '#e8e6e3',
  '#9a9a9a'
]

export function VaultfetchPanel({ snap, opts }: { snap: HudSnapshot; opts: FetchOptions }) {
  // 1s tick so uptime stays live; a separate counter rotates the quote
  const [, setTick] = useState(0)
  const [qi, setQi] = useState(() => Math.floor(Math.random() * Math.max(1, snap.quotes.length)))
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (opts.quoteRotateSec <= 0 || snap.quotes.length < 2) return
    const t = setInterval(
      () => setQi((i) => (i + 1 + Math.floor(Math.random() * (snap.quotes.length - 1))) % snap.quotes.length),
      opts.quoteRotateSec * 1000
    )
    return () => clearInterval(t)
  }, [opts.quoteRotateSec, snap.quotes.length])

  const logo = spriteToHalfBlocks(PANDA, DEFAULT_PALETTE)
  const lines = fetchLines(snap, Date.now(), opts.lines)
  const quote = snap.quotes[qi % Math.max(1, snap.quotes.length)] ?? ''
  const header = `${snap.pet.name}@${snap.appName}`

  return (
    <Panel title="◈ VAULTFETCH">
      <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1 }}>
        {opts.showLogo && (
          <div style={{ lineHeight: '0.62em', letterSpacing: 0, whiteSpace: 'pre' }}>
            {logo.map((row, y) => (
              <div key={y} style={{ display: 'flex' }}>
                {row.map((c, x) => (
                  <span key={x} style={{ color: c.fg ?? 'transparent', background: c.bg ?? 'transparent' }}>
                    {c.ch}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 2, alignContent: 'start' }}>
          <div className="clay" style={{ gridColumn: '1 / -1' }}>{header}</div>
          <div className="dim" style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--line)', marginBottom: 2 }} />
          {lines.map((l) => (
            <Fragment key={l.id}>
              <span className="dim">{l.label}</span>
              <span>{l.value}</span>
            </Fragment>
          ))}
        </div>
      </div>
      {opts.showSwatches && (
        <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
          {SWATCHES.map((c, i) => (
            <span key={i} style={{ width: 14, height: 8, background: c, display: 'inline-block' }} />
          ))}
        </div>
      )}
      <div className="dim" style={{ marginTop: 8, fontStyle: 'italic', fontSize: 10 }}>&ldquo;{quote}&rdquo;</div>
    </Panel>
  )
}
