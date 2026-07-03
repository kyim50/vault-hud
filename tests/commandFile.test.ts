import { describe, it, expect } from 'vitest'
import { parseCommandFile, renderPrompt } from '../src/main/commands/commandFile'

const raw = `---
label: Morning Brief
description: Inbox + calendar + overnight git
allowed-tools: Read Write Bash(git -C:*)
---
Write a brief to {{vaultPath}}/Dashboard for {{date}}.`

describe('parseCommandFile', () => {
  it('parses frontmatter and body', () => {
    const parsed = parseCommandFile(raw, 'morning-brief')
    expect(parsed.info).toEqual({
      id: 'morning-brief',
      label: 'Morning Brief',
      description: 'Inbox + calendar + overnight git'
    })
    expect(parsed.allowedTools).toBe('Read Write Bash(git -C:*)')
    expect(parsed.prompt).toBe('Write a brief to {{vaultPath}}/Dashboard for {{date}}.')
  })
  it('defaults label to id when frontmatter missing', () => {
    const parsed = parseCommandFile('Just a prompt.', 'week-review')
    expect(parsed.info.label).toBe('week-review')
    expect(parsed.prompt).toBe('Just a prompt.')
  })
})

describe('renderPrompt', () => {
  it('substitutes all {{vars}}', () => {
    expect(renderPrompt('a {{x}} b {{x}} {{y}}', { x: '1', y: '2' })).toBe('a 1 b 1 2')
  })
})
