import { Fragment, useEffect, useRef, useState } from 'react'
import type { HudSnapshot } from '@shared/types'
import { Panel } from './Panel'
import { PANDA_MINI, DEFAULT_PALETTE, pandaColor, type PandaPalette } from '../lib/panda'
import { fetchLines, type FetchLineId } from '../lib/fetchLines'
import { getActiveTheme } from '../theme/apply'

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

export function VaultfetchPanel({ snap, opts }: { snap: HudSnapshot; opts: FetchOptions }) {
  // 1s tick so uptime stays live; a separate counter rotates the quote
  const [, setTick] = useState(0)
  const [qi, setQi] = useState(() => Math.floor(Math.random() * Math.max(1, snap.quotes.length)))
  const logoRef = useRef<HTMLCanvasElement>(null)
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

  const at = getActiveTheme()
  const SWATCHES = at
    ? [at.colors.mascotBody, at.colors.mascotDark, at.colors.mascotMuzzle, at.colors.mascotEye, at.colors.ink, at.colors.inkDim]
    : [DEFAULT_PALETTE.body, DEFAULT_PALETTE.dark, DEFAULT_PALETTE.muzzle, DEFAULT_PALETTE.eye, '#e8e6e3', '#9a9a9a']

  // mascot logo follows the active theme; drawn as real pixels on a canvas so it
  // keeps its 14×9 aspect regardless of the mono font's glyph metrics
  const mascotPal: PandaPalette = at
    ? { body: at.colors.mascotBody, dark: at.colors.mascotDark, ink: at.colors.ink, eye: at.colors.mascotEye, muzzle: at.colors.mascotMuzzle }
    : DEFAULT_PALETTE
  const mascotSprite = snap.sprites.find((s) => s.use === 'mascot')
  useEffect(() => {
    const cv = logoRef.current
    if (!cv || !opts.showLogo) return
    const grid = mascotSprite?.grid
    const w = grid ? (grid[0]?.length ?? 0) : PANDA_MINI[0].length
    const h = grid ? grid.length : PANDA_MINI.length
    if (w === 0 || h === 0) return
    const scale = 4
    const dpr = window.devicePixelRatio || 1
    cv.width = w * scale * dpr
    cv.height = h * scale * dpr
    cv.style.width = `${w * scale}px`
    cv.style.height = `${h * scale}px`
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w * scale, h * scale)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const col = grid ? grid[y][x] : pandaColor(PANDA_MINI[y][x] ?? '.', mascotPal, false)
        if (col) {
          ctx.fillStyle = col
          ctx.fillRect(x * scale, y * scale, scale, scale)
        }
      }
    }
  }, [opts.showLogo, mascotSprite, mascotPal.body, mascotPal.dark, mascotPal.ink, mascotPal.eye, mascotPal.muzzle])

  const lines = fetchLines(snap, Date.now(), opts.lines)
  const quote = snap.quotes[qi % Math.max(1, snap.quotes.length)] ?? ''
  const header = `${snap.pet.name}@${snap.appName}`

  return (
    <Panel title="◈ VAULTFETCH">
      <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1, overflow: 'hidden' }}>
        {opts.showLogo && (
          <canvas ref={logoRef} style={{ imageRendering: 'pixelated', flexShrink: 0, alignSelf: 'flex-start' }} />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 2, alignContent: 'start', minWidth: 0 }}>
          <div className="clay" style={{ gridColumn: '1 / -1' }}>{header}</div>
          <div className="dim" style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--line)', marginBottom: 2 }} />
          {lines.map((l) => (
            <Fragment key={l.id}>
              <span className="dim">{l.label}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.value}</span>
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
