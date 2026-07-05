import { useState } from 'react'
import type { HudSnapshot } from '@shared/types'
import { AppearanceTab } from './settings/AppearanceTab'
import { ScenesTab } from './settings/ScenesTab'
import { SpritesTab } from './settings/SpritesTab'

type Tab = 'appearance' | 'layout' | 'scenes' | 'sprites' | 'share'
const TABS: Tab[] = ['appearance', 'layout', 'scenes', 'sprites', 'share']

export function SettingsPanel({ snap, onClose }: { snap: HudSnapshot; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('appearance')
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ width: 'min(640px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <header className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Settings</span>
          <span className="corner" style={{ cursor: 'pointer' }} onClick={onClose}>✕ close</span>
        </header>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px dotted var(--line-soft)', paddingBottom: 8 }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, letterSpacing: 1, padding: '4px 8px', color: tab === t ? 'var(--clay)' : 'var(--ink)' }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tab === 'appearance' && <AppearanceTab snap={snap} />}
          {tab === 'scenes' && <ScenesTab snap={snap} />}
          {tab === 'sprites' && <SpritesTab snap={snap} />}
          {tab === 'layout' && <div className="dim" style={{ fontSize: 11, padding: 8 }}>layout manager — coming in this build</div>}
          {tab === 'share' && <div className="dim" style={{ fontSize: 11, padding: 8 }}>share — coming in this build</div>}
        </div>
      </div>
    </div>
  )
}
