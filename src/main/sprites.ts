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
    ['parade', 'pet', 'none'].includes(s.use)
  )
}

export async function loadSprites(): Promise<CustomSprite[]> {
  try {
    const raw = JSON.parse(await fs.readFile(SPRITES_PATH, 'utf8'))
    return Array.isArray(raw) ? raw.filter(sane).slice(0, MAX_SPRITES) : []
  } catch {
    return []
  }
}

export async function saveSprite(list: CustomSprite[], sprite: CustomSprite): Promise<CustomSprite[]> {
  if (!sane(sprite)) return list
  const next = [...list.filter((s) => s.name !== sprite.name), sprite].slice(-MAX_SPRITES)
  // a sprite use is exclusive for 'pet' — only one pet skin at a time
  if (sprite.use === 'pet') {
    for (const s of next) if (s.name !== sprite.name && s.use === 'pet') s.use = 'none'
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
