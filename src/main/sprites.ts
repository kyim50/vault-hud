import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { CustomSprite } from '@shared/types'
import { CONFIG_DIR } from './config'

// Custom sprites live beside the config so friends' installs keep theirs.
const SPRITES_PATH = join(CONFIG_DIR, 'sprites.json')
const MAX_SPRITES = 12
const MAX_DIM = 32

function sane(s: CustomSprite): boolean {
  return (
    typeof s.name === 'string' && s.name.length > 0 && s.name.length <= 24 &&
    Array.isArray(s.grid) && s.grid.length > 0 && s.grid.length <= MAX_DIM &&
    s.grid.every((row) => Array.isArray(row) && row.length <= MAX_DIM && row.every((c) => typeof c === 'string' && c.length <= 9)) &&
    ['frame', 'totem', 'none'].includes(s.use)
  )
}

// sprites saved before the frame/totem existed used 'parade'/'pet' — the
// parade became the frame patrol, and the pet's spiritual successor is the
// totem panel
function migrate(s: CustomSprite): CustomSprite {
  const use = s.use as string
  if (use === 'parade') return { ...s, use: 'frame' }
  if (use === 'pet') return { ...s, use: 'totem' }
  return s
}

export async function loadSprites(): Promise<CustomSprite[]> {
  try {
    const raw = JSON.parse(await fs.readFile(SPRITES_PATH, 'utf8'))
    return Array.isArray(raw) ? raw.map(migrate).filter(sane).slice(0, MAX_SPRITES) : []
  } catch {
    return []
  }
}

export async function saveSprite(list: CustomSprite[], sprite: CustomSprite): Promise<CustomSprite[]> {
  if (!sane(sprite)) return list
  const next = [...list.filter((s) => s.name !== sprite.name), sprite].slice(-MAX_SPRITES)
  // the totem slot is exclusive — one displayed sprite at a time
  if (sprite.use === 'totem') {
    for (const s of next) if (s.name !== sprite.name && s.use === 'totem') s.use = 'none'
  }
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(SPRITES_PATH, JSON.stringify(next))
  } catch {
    /* fail soft */
  }
  return next
}

export async function deleteSprite(list: CustomSprite[], name: string): Promise<CustomSprite[]> {
  const next = list.filter((s) => s.name !== name)
  try {
    await fs.writeFile(SPRITES_PATH, JSON.stringify(next))
  } catch {
    /* fail soft */
  }
  return next
}
