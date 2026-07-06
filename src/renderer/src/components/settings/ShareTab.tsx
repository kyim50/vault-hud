import { useState } from 'react'
import type { HudSnapshot } from '@shared/types'
import { buildRice, parseRice } from '../../lib/rice'
import { Section } from './primitives'

export function ShareTab({ snap }: { snap: HudSnapshot }) {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')

  const exportRice = (): string => JSON.stringify(buildRice(snap), null, 2)

  const copy = (): void => {
    const out = exportRice()
    navigator.clipboard?.writeText(out).then(
      () => setMsg('copied to clipboard'),
      () => setMsg('copy failed — use download')
    )
  }
  const download = (): void => {
    const blob = new Blob([exportRice()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${snap.ui.theme || 'vault'}.rice.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('downloaded')
  }
  const importRice = (): void => {
    const res = parseRice(text)
    if (!res.ok) {
      setMsg(`import failed — ${res.error}`)
      return
    }
    const b = res.bundle
    window.vault.updateConfig({ ui: { ...b.ui, themes: { ...(snap.ui.themes ?? {}), ...(b.themes ?? {}) } } })
    for (const s of b.sprites ?? []) window.vault.saveSprite(s)
    setMsg('rice applied — your HUD now matches it')
  }

  return (
    <>
      <Section title="EXPORT">
        <div className="dim" style={{ fontSize: 10 }}>bundle your whole look — theme, layout, scenes, sizes, sprites — into one file to share.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={copy} style={{ fontSize: 10 }}>· copy to clipboard</button>
          <button onClick={download} style={{ fontSize: 10 }}>· download .rice.json</button>
        </div>
      </Section>
      <Section title="IMPORT">
        <div className="dim" style={{ fontSize: 10 }}>paste someone's rice below and apply — your HUD becomes their setup, live.</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="paste a .rice.json here"
          style={{ width: '100%', height: 90, background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: 6, resize: 'vertical' }}
        />
        <button onClick={importRice} disabled={!text.trim()} style={{ fontSize: 10 }}>· apply rice</button>
      </Section>
      {msg && <div className="clay" style={{ fontSize: 10, marginTop: 6 }}>{msg}</div>}
    </>
  )
}
