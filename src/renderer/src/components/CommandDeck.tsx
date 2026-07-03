import { useState } from 'react'
import type { CommandInfo, CommandStatus } from '@shared/types'
import { Panel } from './Panel'

const STATE_GLYPH: Record<string, string> = {
  idle: '·', queued: '…', running: '▶', done: '✓', failed: '✕'
}

export function CommandDeck({ commands }: { commands: { info: CommandInfo; status: CommandStatus }[] }) {
  const [logFor, setLogFor] = useState<string | null>(null)
  const open = commands.find((c) => c.info.id === logFor)
  return (
    <Panel title="Command Deck" corner={`${commands.filter((c) => c.status.state === 'running').length} ACTIVE`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {commands.map(({ info, status }) => (
          <button
            key={info.id}
            onClick={() =>
              status.state === 'failed' || status.state === 'done'
                ? setLogFor(logFor === info.id ? null : info.id)
                : window.vault.runCommand(info.id)
            }
            onDoubleClick={() => window.vault.runCommand(info.id)}
            title={`${info.description}${status.state === 'done' || status.state === 'failed' ? ' — click for log, double-click to rerun' : ''}`}
            style={{
              color:
                status.state === 'failed' ? 'var(--danger)'
                : status.state === 'running' ? 'var(--accent)'
                : 'var(--ink)'
            }}
          >
            <span className={status.state === 'running' ? 'blink' : 'dim'}>{STATE_GLYPH[status.state]} </span>
            {info.label}
          </button>
        ))}
      </div>
      {open?.status.log && (
        <pre
          style={{
            fontSize: 10, maxHeight: 140, overflow: 'auto', background: '#000',
            border: '1px solid var(--line)', padding: 8, whiteSpace: 'pre-wrap',
            color: open.status.state === 'failed' ? 'var(--danger)' : 'var(--ink-dim)'
          }}
        >
          {open.status.log}
        </pre>
      )}
    </Panel>
  )
}
