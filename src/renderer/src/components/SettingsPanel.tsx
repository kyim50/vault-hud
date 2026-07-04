import { useRef, useState } from 'react'
import type { CustomSprite, HudSnapshot } from '@shared/types'

// Settings overlay: theme, parade, pet name, repos, and the Sprite Studio —
// drop an image, it gets crunched into vault's ink+clay 8-bit language.
const INK = '#e8e6e3'
const GRAY = '#9a9a9a'
const EYE = '#17160f'
const BODY = '#d97757'
const DARK = '#b85c3f'

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
]

// quantize an image into the app's palette on a small grid
function crunch(img: HTMLImageElement, size = 24): string[][] {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  // cover-fit crop to square
  const s = Math.min(img.width, img.height)
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data
  const grid: string[][] = []
  for (let y = 0; y < size; y++) {
    const row: string[] = []
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a < 100) {
        row.push('')
        continue
      }
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      const warm = r > g && g >= b
      const threshold = (BAYER[y % 4][x % 4] + 0.5) / 16
      if (sat > 0.3 && warm) {
        row.push(lum > 0.45 ? BODY : DARK)
      } else if (lum > 0.78) {
        row.push(INK)
      } else if (lum > 0.45) {
        row.push(lum - 0.3 > threshold * 0.5 ? GRAY : INK)
      } else if (lum > 0.22) {
        row.push(lum > threshold * 0.45 ? GRAY : EYE)
      } else {
        row.push(EYE)
      }
    }
    grid.push(row)
  }
  return grid
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

export function SettingsPanel({ snap, onClose }: { snap: HudSnapshot; onClose: () => void }) {
  const [petName, setPetName] = useState(snap.pet.name)
  const [draft, setDraft] = useState<{ name: string; grid: string[][] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const label = { fontFamily: 'var(--font-pixel)', fontSize: 7, letterSpacing: 1 } as const
  const row = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 } as const

  const onFile = (f: File): void => {
    const img = new Image()
    img.onload = () => setDraft({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 16) || 'sprite', grid: crunch(img) })
    img.src = URL.createObjectURL(f)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ width: 460, maxHeight: '84vh', overflowY: 'auto', gap: 12 }}
      >
        <header className="panel-title">
          <span>Settings</span>
          <span className="corner" style={{ cursor: 'pointer' }} onClick={onClose}>✕ close</span>
        </header>

        <div style={row}>
          <span style={{ ...label, width: 70 }}>THEME</span>
          {(['terminal', 'paper'] as const).map((t) => (
            <button
              key={t}
              onClick={() => window.vault.updateConfig({ ui: { theme: t } })}
              style={{ color: snap.ui.theme === t ? 'var(--clay)' : 'var(--ink)', fontSize: 10 }}
            >
              {snap.ui.theme === t ? '● ' : '○ '}{t}
            </button>
          ))}
        </div>

        <div style={row}>
          <span style={{ ...label, width: 70 }}>PARADE</span>
          <button onClick={() => window.vault.updateConfig({ ui: { parade: !snap.ui.parade } })} style={{ fontSize: 10 }}>
            {snap.ui.parade ? '● on — critters cross the top' : '○ off'}
          </button>
        </div>

        <div style={row}>
          <span style={{ ...label, width: 70 }}>PET NAME</span>
          <input
            value={petName}
            maxLength={12}
            onChange={(e) => setPetName(e.target.value)}
            onBlur={() => petName.trim() && window.vault.updateConfig({ petName })}
            style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 6px', width: 120 }}
          />
        </div>

        <div style={{ borderTop: '1px dotted var(--line-soft)', paddingTop: 8 }}>
          <div style={{ ...label, marginBottom: 6 }}>SPRITE STUDIO</div>
          <div className="dim" style={{ fontSize: 10, marginBottom: 6 }}>
            drop any image — it becomes an 8-bit sprite in vault's ink + clay. put it in the parade or make it your pet.
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
                {(['parade', 'pet', 'none'] as const).map((use) => (
                  <button
                    key={use}
                    onClick={() => {
                      window.vault.saveSprite({ name: draft.name || 'sprite', grid: draft.grid, use })
                      setDraft(null)
                    }}
                    style={{ fontSize: 10 }}
                  >
                    save → {use === 'none' ? 'library only' : use}
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
                  {(['parade', 'pet', 'none'] as const).map((use) => (
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
        </div>

        <div style={{ borderTop: '1px dotted var(--line-soft)', paddingTop: 8 }}>
          <div style={{ ...label, marginBottom: 6 }}>REPOS</div>
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
        </div>
      </div>
    </div>
  )
}
