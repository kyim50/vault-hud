import { useRef, useState } from 'react'
import type { CustomSprite, HudSnapshot } from '@shared/types'
import { crunchImageData } from '../../lib/quantize'
import { Section } from './primitives'

const label = { fontFamily: 'var(--font-pixel)', fontSize: 7, letterSpacing: 1 } as const

function crunch(img: HTMLImageElement, size = 24): string[][] {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // cover-fit crop to square
  const s = Math.min(img.width, img.height)
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
  return crunchImageData(ctx.getImageData(0, 0, size, size).data, size, size)
}

function SpritePreview({ grid, cell = 5 }: { grid: string[][]; cell?: number }) {
  const w = (grid[0]?.length ?? 0) * cell
  const h = grid.length * cell
  return (
    <canvas
      width={w}
      height={h}
      style={{ imageRendering: 'pixelated', background: 'var(--bg)', border: '1px solid var(--line-soft)' }}
      ref={(el) => {
        if (!el) return
        const ctx = el.getContext('2d')!
        ctx.clearRect(0, 0, w, h)
        grid.forEach((row, y) =>
          row.forEach((col, x) => {
            if (!col) return
            ctx.fillStyle = col
            ctx.fillRect(x * cell, y * cell, cell, cell)
          })
        )
      }}
    />
  )
}

export function SpritesTab({ snap }: { snap: HudSnapshot }) {
  const [draft, setDraft] = useState<{ name: string; grid: string[][] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const onFile = (f: File): void => {
    const img = new Image()
    img.onload = () => setDraft({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 16) || 'sprite', grid: crunch(img) })
    img.src = URL.createObjectURL(f)
  }
  return (
    <>
      <Section title="SPRITE STUDIO">
        <div className="dim" style={{ fontSize: 10, marginBottom: 6 }}>
          drop any image — it becomes a flat 8-bit sprite in its own palette, backdrop stripped. show it big in the totem panel or send it on frame patrol.
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} style={{ fontSize: 10 }}>· choose image</button>
        {draft && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 10 }}>
            <SpritePreview grid={draft.grid} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                value={draft.name}
                maxLength={16}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 6px', width: 130 }}
              />
              {(['totem', 'frame', 'none'] as const).map((use) => (
                <button
                  key={use}
                  onClick={() => {
                    window.vault.saveSprite({ name: draft.name || 'sprite', grid: draft.grid, use })
                    setDraft(null)
                  }}
                  style={{ fontSize: 10 }}
                >
                  save → {use === 'none' ? 'library only' : use === 'totem' ? 'totem panel' : 'frame patrol'}
                </button>
              ))}
            </div>
          </div>
        )}
        {snap.sprites.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {snap.sprites.map((s: CustomSprite) => (
              <div key={s.name} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <SpritePreview grid={s.grid} cell={2} />
                <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                {(['totem', 'frame', 'none'] as const).map((use) => (
                  <span
                    key={use}
                    onClick={() => window.vault.saveSprite({ ...s, use })}
                    style={{ ...label, cursor: 'pointer', color: s.use === use ? 'var(--clay)' : 'var(--ink-dim)' }}
                  >
                    {use}
                  </span>
                ))}
                <span onClick={() => window.vault.deleteSprite(s.name)} style={{ cursor: 'pointer', color: 'var(--danger)', fontSize: 10 }}>✕</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="REPOS">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {snap.repos.map((r) => (
            <label key={r.path} style={{ display: 'flex', gap: 6, fontSize: 10, alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                defaultChecked
                style={{ accentColor: 'var(--ink)' }}
                onChange={(e) => {
                  const keep = snap.repos.filter((x) => x.path !== r.path || e.target.checked).map((x) => ({ name: x.name, path: x.path }))
                  window.vault.updateConfig({ repos: keep })
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            </label>
          ))}
        </div>
        <div className="dim" style={{ fontSize: 9, marginTop: 4 }}>unchecking removes a repo from tracking (saved immediately)</div>
      </Section>
    </>
  )
}
