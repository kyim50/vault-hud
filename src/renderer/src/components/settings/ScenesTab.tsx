import { useRef, useState } from 'react'
import type { CustomScene, HudSnapshot, SceneProp } from '@shared/types'
import { ROTATION_DEFAULT } from '../../lib/resolveScenes'
import { drawCustomScene } from '../../lib/drawCustomScene'
import { SCENE_NAMES } from '../CoreScene'
import { Section, Row, Stepper, Chips, Picker } from './primitives'

export function ScenesTab({ snap }: { snap: HudSnapshot }) {
  const rotation = snap.ui.scenes?.rotation ?? ROTATION_DEFAULT
  const interval = snap.ui.scenes?.intervalSec ?? 22
  const customScenes = snap.ui.customScenes ?? []
  const allSceneNames = [...SCENE_NAMES, ...customScenes.map((s) => s.name)]
  const rotatable = [...ROTATION_DEFAULT, ...customScenes.map((s) => s.name)]
  const toggleScene = (name: string): void => {
    const set = new Set(rotation)
    set.has(name) ? set.delete(name) : set.add(name)
    const next = rotatable.filter((n) => set.has(n))
    if (next.length === 0) return // never leave the Core with nothing to show
    window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, rotation: next } } })
  }
  const setInterval = (n: number): void =>
    window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, intervalSec: Math.max(3, Math.min(600, n)) } } })

  const [draft, setDraft] = useState<CustomScene | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const spriteNames = snap.sprites.map((s) => s.name)

  const newScene = (): void =>
    setDraft({ name: '', sky: ['#1a2340', '#05060f'], ground: '#0e1013', props: [] })
  const patchDraft = (p: Partial<CustomScene>): void => setDraft((d) => (d ? { ...d, ...p } : d))
  const addProp = (): void => {
    if (!draft || spriteNames.length === 0) return
    patchDraft({ props: [...draft.props, { sprite: spriteNames[0], x: 50, y: 65, scale: 2, drift: true }] })
  }
  const patchProp = (i: number, p: Partial<SceneProp>): void => {
    if (!draft) return
    patchDraft({ props: draft.props.map((pr, j) => (j === i ? { ...pr, ...p } : pr)) })
  }
  const removeProp = (i: number): void => {
    if (draft) patchDraft({ props: draft.props.filter((_, j) => j !== i) })
  }
  const saveScene = (): void => {
    if (!draft || !draft.name.trim() || SCENE_NAMES.includes(draft.name.trim())) return
    const name = draft.name.trim()
    const next = [...customScenes.filter((s) => s.name !== name), { ...draft, name }]
    window.vault.updateConfig({ ui: { customScenes: next } })
    setDraft(null)
  }
  const removeScene = (name: string): void =>
    window.vault.updateConfig({ ui: { customScenes: customScenes.filter((s) => s.name !== name) } })

  // live preview: redraw whenever the draft changes
  const drawPreview = (cv: HTMLCanvasElement | null): void => {
    if (!cv || !draft) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const map = new Map(snap.sprites.map((s) => [s.name, s.grid]))
    drawCustomScene(ctx, draft, map, 0, cv.width, cv.height)
  }

  return (
    <>
      <Section title="ROTATION">
        <Row label="SCENES">
          <Chips items={rotatable} active={(n) => rotation.includes(n)} onPick={toggleScene} />
        </Row>
        <Row label="SPEED">
          <Stepper value={interval} suffix="s per scene" onDec={() => setInterval(interval - 4)} onInc={() => setInterval(interval + 4)} />
        </Row>
        <Row label="BUSY">
          <Picker
            value={snap.ui.scenes?.busy ?? 'disco'}
            options={allSceneNames}
            onPick={(busy) => window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, busy } } })}
          />
          <span className="dim" style={{ fontSize: 10 }}>plays while a command runs</span>
        </Row>
        <Row label="NAP">
          <Picker
            value={snap.ui.scenes?.nap ?? 'nap'}
            options={allSceneNames}
            onPick={(nap) => window.vault.updateConfig({ ui: { scenes: { ...snap.ui.scenes, nap } } })}
          />
          <span className="dim" style={{ fontSize: 10 }}>plays after 90min idle</span>
        </Row>
      </Section>
      <Section title="SCENE STUDIO">
        {customScenes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {customScenes.map((s) => (
              <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, border: '1px solid var(--line-soft)', borderRadius: 4, padding: '2px 6px' }}>
                {s.name}
                <span onClick={() => removeScene(s.name)} style={{ cursor: 'pointer', color: 'var(--danger)' }}>✕</span>
              </span>
            ))}
          </div>
        )}
        {!draft && (
          <button onClick={newScene} style={{ fontSize: 10 }} disabled={spriteNames.length === 0}>
            {spriteNames.length === 0 ? '+ new scene (make a sprite first)' : '+ new scene'}
          </button>
        )}
        {draft && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--line-soft)', padding: 10 }}>
            <canvas ref={(el) => { previewRef.current = el; drawPreview(el) }} width={192} height={108} style={{ width: 240, height: 135, imageRendering: 'pixelated', border: '1px solid var(--line-soft)', alignSelf: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 10 }}>
              <span className="dim">name</span>
              <input value={draft.name} maxLength={16} onChange={(e) => patchDraft({ name: e.target.value })}
                style={{ background: 'var(--bg)', color: 'var(--ink)', border: '1px solid var(--line-soft)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 6px', width: 110 }} />
              <span className="dim">sky</span>
              <input type="color" value={draft.sky[0]} onChange={(e) => patchDraft({ sky: [e.target.value, draft.sky[1]] })} />
              <input type="color" value={draft.sky[1]} onChange={(e) => patchDraft({ sky: [draft.sky[0], e.target.value] })} />
              <span className="dim">ground</span>
              <input type="color" value={draft.ground} onChange={(e) => patchDraft({ ground: e.target.value })} />
            </div>
            {draft.props.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                <Picker value={p.sprite} options={spriteNames} onPick={(sprite) => patchProp(i, { sprite })} />
                <span className="dim">x</span><button onClick={() => patchProp(i, { x: Math.max(0, p.x - 5) })}>−</button><span className="dim" style={{ minWidth: 26, textAlign: 'center' }}>{p.x}</span><button onClick={() => patchProp(i, { x: Math.min(100, p.x + 5) })}>+</button>
                <span className="dim">y</span><button onClick={() => patchProp(i, { y: Math.max(0, p.y - 5) })}>−</button><span className="dim" style={{ minWidth: 26, textAlign: 'center' }}>{p.y}</span><button onClick={() => patchProp(i, { y: Math.min(100, p.y + 5) })}>+</button>
                <span className="dim">×</span><button onClick={() => patchProp(i, { scale: Math.max(1, p.scale - 1) })}>−</button><span className="dim">{p.scale}</span><button onClick={() => patchProp(i, { scale: Math.min(4, p.scale + 1) })}>+</button>
                <button onClick={() => patchProp(i, { drift: !p.drift })} style={{ color: p.drift ? 'var(--clay)' : 'var(--ink)' }}>{p.drift ? '● drift' : '○ drift'}</button>
                <span onClick={() => removeProp(i)} style={{ cursor: 'pointer', color: 'var(--danger)' }}>✕</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addProp} style={{ fontSize: 10 }} disabled={spriteNames.length === 0}>+ sprite</button>
              <button onClick={saveScene} style={{ fontSize: 10 }} disabled={!draft.name.trim() || SCENE_NAMES.includes(draft.name.trim())}>save scene</button>
              <button onClick={() => setDraft(null)} style={{ fontSize: 10 }}>cancel</button>
            </div>
            <div className="dim" style={{ fontSize: 9 }}>preview is a still; drift animates in the Core. save, then check the scene into rotation above.</div>
          </div>
        )}
      </Section>
    </>
  )
}
