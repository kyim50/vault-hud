import { useEffect, useMemo, useRef } from 'react'
import type { CustomScene, CustomSprite, LinkGraph, Mood, SceneConfig } from '@shared/types'
import { PANDA, PANDA_BODY_ROWS, PANDA_BUDDY, drawPanda } from '../lib/panda'
import { sceneColors, scenePalette } from '../theme/sceneColors'
import { layoutConstellation, hitStar, type Star } from '../lib/constellation'
import { drawPixelText, measurePixelText } from '../lib/pixelfont'
import { loadingPhase } from '../lib/loadingTransition'
import { resolveScenes, ROTATION_DEFAULT } from '../lib/resolveScenes'
import { resolveCustomScenes } from '../lib/resolveCustomScene'
import { drawCustomScene } from '../lib/drawCustomScene'

// Halftone scene engine: the red panda living out rotating pixel scenes.
// Dual-state canvas: hovering a Second Brain note dissolves the scene into
// the wiki-link constellation graph; wandering off dissolves it back.
const W = 192
const H = 108

const FPS = 12

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967296
}

// smooth back-and-forth wander between min and max
function wander(f: number, min: number, max: number, speed: number, phase = 0): number {
  const span = max - min
  const t = (f * speed + phase) % (span * 2)
  return min + (t < span ? t : span * 2 - t)
}

type Ctx = CanvasRenderingContext2D
type SceneFn = (ctx: Ctx, f: number, blink: boolean) => void
interface SceneDef { name: string; draw: SceneFn; horizon?: number }

function drawWalker(ctx: Ctx, f: number, blink: boolean, x: number, groundY: number, moving: boolean): void {
  const bob = moving ? (Math.floor(f / 3) % 2) : (Math.floor(f / 8) % 2)
  drawPanda(ctx, PANDA, Math.round(x), groundY - PANDA.length * 2 + bob, 2, scenePalette, { blink, step: bob as 0 | 1 })
}

function drawSitter(ctx: Ctx, blink: boolean, x: number, y: number): void {
  drawPanda(ctx, PANDA.slice(0, PANDA_BODY_ROWS), Math.round(x), y, 2, scenePalette, { blink })
}

function drawBuddy(ctx: Ctx, f: number, blink: boolean, x: number, groundY: number, hopBeat = 4): void {
  const hop = Math.floor(f / hopBeat) % 3 === 0 ? -2 : 0
  drawPanda(ctx, PANDA_BUDDY, Math.round(x), groundY - PANDA_BUDDY.length * 2 + hop, 2, scenePalette, { blink })
}

function drawCloud(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.fillStyle = sceneColors.ink
  for (let y = -ry; y <= ry; y += 2) {
    for (let x = -rx; x <= rx; x += 2) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry)
      if (d > 1) continue
      if (hash(Math.round(cx + x), Math.round(cy + y)) < 0.85 - d * 0.75) {
        ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1)
      }
    }
  }
}

function drawGround(ctx: Ctx, horizon: number, maxDensity = 0.4): void {
  ctx.fillStyle = sceneColors.ink
  for (let y = horizon; y < H; y += 2) {
    const t = (y - horizon) / (H - horizon)
    const density = 0.07 + t * (maxDensity - 0.07)
    for (let x = 0; x < W; x += 2) {
      if (hash(x, y) < density) ctx.fillRect(x, y, 1, 1)
    }
  }
}

function drawBird(ctx: Ctx, x: number, y: number, flap: boolean): void {
  ctx.fillStyle = sceneColors.ink
  const px = Math.round(x)
  const py = Math.round(y)
  if (flap) {
    ctx.fillRect(px - 3, py - 2, 2, 1)
    ctx.fillRect(px + 2, py - 2, 2, 1)
    ctx.fillRect(px - 1, py - 1, 3, 1)
  } else {
    ctx.fillRect(px - 4, py, 3, 1)
    ctx.fillRect(px + 2, py, 3, 1)
    ctx.fillRect(px - 1, py - 1, 3, 1)
  }
}

function drawButterfly(ctx: Ctx, f: number, x: number, y: number): void {
  ctx.fillStyle = sceneColors.ink
  const open = Math.floor(f / 2) % 2 === 0
  ctx.fillRect(Math.round(x) - (open ? 2 : 1), Math.round(y), open ? 2 : 1, 1)
  ctx.fillRect(Math.round(x) + 1, Math.round(y), open ? 2 : 1, 1)
}

function drawHills(ctx: Ctx, horizon: number, seed: number): void {
  ctx.fillStyle = sceneColors.ink
  for (let x = 0; x < W; x += 2) {
    const h1 = Math.sin(x / 34 + seed) * 7 + Math.sin(x / 13 + seed * 2) * 3
    const top = horizon - 10 - h1
    for (let y = Math.round(top); y < horizon; y += 2) {
      if (hash(x, y + seed) < 0.14) ctx.fillRect(x, y, 1, 1)
    }
    if (hash(x, seed) < 0.5) ctx.fillRect(x, Math.round(top), 1, 1)
  }
}

function drawFlower(ctx: Ctx, x: number, y: number, f: number): void {
  ctx.fillStyle = sceneColors.ink
  const sway = Math.floor(f / 8) % 2
  ctx.fillRect(x + sway, y - 4, 1, 1)
  ctx.fillRect(x - 1 + sway, y - 3, 3, 1)
  ctx.fillRect(x + sway, y - 2, 1, 1)
  ctx.fillRect(x, y - 1, 1, 1)
}

// --- loot props ---------------------------------------------------------
// accessories earned from command runs furnish the panda's ground scenes

function drawProp(ctx: Ctx, name: string, x: number, groundY: number, f: number): void {
  const g = groundY
  switch (name) {
    case 'plant': {
      ctx.fillStyle = scenePalette.dark
      ctx.fillRect(x - 2, g - 3, 5, 3)
      ctx.fillStyle = sceneColors.ink
      for (let i = -3; i <= 3; i++) if (hash(x + i, 1) < 0.7) ctx.fillRect(x + i, g - 6 - Math.abs(i) % 2, 1, 2)
      break
    }
    case 'hat':
      ctx.fillStyle = scenePalette.dark
      ctx.fillRect(x - 3, g - 2, 7, 2)
      ctx.fillRect(x - 1, g - 5, 3, 3)
      break
    case 'snail':
      ctx.fillStyle = sceneColors.ink
      ctx.fillRect(x, g - 4, 4, 4)
      ctx.fillRect(x + 1, g - 3, 2, 2)
      ctx.fillStyle = scenePalette.dark
      ctx.fillRect(x - 3, g - 2, 4, 2)
      ctx.fillRect(x - 4, g - 5, 1, 3)
      break
    case 'mug':
      ctx.fillStyle = sceneColors.ink
      ctx.fillRect(x - 2, g - 4, 4, 4)
      ctx.fillRect(x + 2, g - 3, 1, 2)
      if (f % 16 < 10) ctx.fillRect(x - 1 + (f % 4 < 2 ? 0 : 1), g - 7 - (f % 16) / 4, 1, 1)
      break
    case 'banner':
      ctx.fillStyle = sceneColors.ink
      ctx.fillRect(x, g - 12, 1, 12)
      ctx.fillStyle = sceneColors.body
      ctx.fillRect(x + 1, g - 12, 5 + (Math.floor(f / 6) % 2), 3)
      break
    case 'lantern':
      ctx.fillStyle = sceneColors.ink
      ctx.fillRect(x, g - 9, 1, 9)
      ctx.fillRect(x - 2, g - 9, 5, 1)
      ctx.fillStyle = Math.floor(f / 8) % 4 === 0 ? scenePalette.dark : sceneColors.body
      ctx.fillRect(x - 1, g - 8, 3, 3)
      break
    case 'books':
      ctx.fillStyle = sceneColors.ink
      ctx.fillRect(x - 3, g - 2, 7, 2)
      ctx.fillStyle = scenePalette.dark
      ctx.fillRect(x - 2, g - 4, 6, 2)
      ctx.fillStyle = sceneColors.ink
      ctx.fillRect(x - 3, g - 6, 5, 2)
      break
    case 'radio':
      ctx.fillStyle = sceneColors.ink
      ctx.fillRect(x - 3, g - 4, 7, 4)
      ctx.fillRect(x + 2, g - 8, 1, 4)
      ctx.fillStyle = sceneColors.eye
      ctx.fillRect(x - 2, g - 3, 2, 2)
      if (f % 10 < 5) {
        ctx.fillStyle = sceneColors.ink
        ctx.fillRect(x + 5, g - 8 - (f % 10), 1, 1)
        ctx.fillRect(x + 6, g - 7 - (f % 10), 1, 2)
      }
      break
  }
}

function drawLoot(ctx: Ctx, loot: string[], horizon: number, f: number): void {
  for (const name of loot.slice(0, 8)) {
    let sx = 0
    for (const ch of name) sx = (sx * 31 + ch.charCodeAt(0)) | 0
    const x = 10 + Math.round(hash(Math.abs(sx), 77) * (W - 20))
    drawProp(ctx, name, x, horizon + 2 + Math.round(hash(Math.abs(sx), 78) * 6), f)
  }
}

// --- scenes ------------------------------------------------------------

function sceneMeadow(ctx: Ctx, f: number, blink: boolean): void {
  const drift = (f * 0.35) % (W + 120)
  drawCloud(ctx, ((30 + drift) % (W + 120)) - 60, 18, 32, 10)
  drawCloud(ctx, ((140 + drift * 0.6) % (W + 120)) - 60, 34, 22, 7)
  drawCloud(ctx, ((90 + drift * 0.45) % (W + 120)) - 60, 10, 18, 5)
  drawCloud(ctx, 168, 14, 8, 7)
  const horizon = 90
  drawHills(ctx, horizon, 5)
  drawGround(ctx, horizon)
  ctx.fillStyle = sceneColors.ink
  for (let i = 0; i < 14; i++) {
    const gx = Math.round(hash(i, 3) * (W - 10)) + 5
    ctx.fillRect(gx, horizon - 2, 1, 2)
    ctx.fillRect(gx + 2, horizon - 1, 1, 1)
  }
  for (let i = 0; i < 5; i++) {
    drawFlower(ctx, Math.round(hash(i, 21) * (W - 20)) + 10, horizon + Math.round(hash(i, 23) * 8), f + i * 3)
  }
  const mx = wander(f, 40, 120, 0.5)
  const moving = Math.abs(wander(f + 1, 40, 120, 0.5) - mx) > 0.1
  drawWalker(ctx, f, blink, mx, horizon, moving)
  drawBuddy(ctx, f, blink, wander(f, 130, 168, 0.8, 60), horizon, 3)
  const t = f % 110
  if (t < 68) drawBird(ctx, -6 + t * 3, 24 + Math.sin(t / 4) * 4, Math.floor(t / 3) % 2 === 0)
  drawButterfly(ctx, f, wander(f, 20, 60, 1.3), 60 + Math.sin(f / 5) * 6)
}

function sceneSurf(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = sceneColors.ink
  drawCloud(ctx, 26, 16, 9, 8)
  const g = f % 90
  if (g < 60) drawBird(ctx, W - g * 2.4, 18 + Math.sin(g / 5) * 3, Math.floor(g / 3) % 2 === 0)
  drawBird(ctx, 52 + Math.sin(f / 9) * 4, 30, Math.floor(f / 4) % 2 === 0)
  for (let k = 0; k < 6; k++) ctx.fillRect(16 + k, 88 - k, 1, 1)
  ctx.fillRect(13, 89, 8, 1)
  const surface = (x: number): number => {
    const sigma = x < 146 ? 34 : 70
    return 102 - 66 * Math.exp(-((x - 146) ** 2) / (2 * sigma * sigma))
  }
  const flow = Math.floor(f * 1.6)
  for (let x = 0; x < W; x += 2) {
    const top = surface(x)
    if (hash(x + flow, 999) < 0.75) ctx.fillRect(x, Math.round(top), 1, 1)
    for (let y = Math.round(top) + 2; y < H; y += 2) {
      const depth = (y - top) / (H - top)
      if (hash(x + flow, y) < 0.1 + depth * 0.42) ctx.fillRect(x, y, 1, 1)
    }
  }
  for (let y = 98; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) if (hash(x + Math.floor(f * 0.8), y + 7) < 0.55) ctx.fillRect(x, y, 1, 1)
  }
  const p0 = { x: 146, y: 33 }
  const p1 = { x: 118, y: 26 }
  const p2 = { x: 108, y: 54 }
  for (let t = 0; t <= 1; t += 0.04) {
    const a = 1 - t
    const x = Math.round(a * a * p0.x + 2 * a * t * p1.x + t * t * p2.x)
    const y = Math.round(a * a * p0.y + 2 * a * t * p1.y + t * t * p2.y)
    ctx.fillRect(x, y, 1, 1)
    if (hash(x, y) < 0.5) ctx.fillRect(x + 1, y + 1, 1, 1)
  }
  for (let i = 0; i < 10; i++) {
    const sx = 104 + Math.round(hash(i, Math.floor(f / 2)) * 52)
    const sy = 18 + Math.round(hash(i + 40, Math.floor(f / 2)) * 24)
    ctx.fillRect(sx, sy, 1, 1)
  }
  const mx = 96 + Math.sin(f / 10) * 8
  let surfY = H
  for (let x = mx - 4; x <= mx + 50; x += 4) surfY = Math.min(surfY, surface(x))
  const boardY = Math.round(surfY + 1 + Math.sin(f / 6) * 3.5)
  ctx.fillStyle = sceneColors.bodyLight
  ctx.fillRect(Math.round(mx - 4), boardY, 54, 3)
  drawSitter(ctx, blink, mx, boardY - PANDA_BODY_ROWS * 2)
}

function sceneDisco(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = sceneColors.ink
  const bx = 96
  const by = 26
  const R = 14
  for (let y = 0; y < by - R; y += 2) ctx.fillRect(bx, y, 1, 2)
  const rot = Math.floor(f / 2) % 6
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      if (x * x + y * y > R * R) continue
      if ((((x + rot + 60) % 6) < 3) !== ((y + 60) % 6 < 3)) {
        if ((x + y) % 2 === 0) ctx.fillRect(bx + x, by + y, 1, 1)
      }
    }
  }
  for (let i = 0; i < 26; i++) {
    if (hash(i, Math.floor(f / 3)) > 0.45) {
      ctx.fillRect(Math.round(hash(i, 7) * (W - 8)) + 4, Math.round(hash(i, 13) * 66) + 8, 1, 1)
    }
  }
  for (let b = 0; b < 3; b++) {
    const ang = Math.PI / 2 + Math.sin(f / 24 + b * 2.1) * 0.7
    for (let r = 18; r < 66; r += 4) {
      const x = Math.round(bx + Math.cos(ang) * r)
      const y = Math.round(by + Math.sin(ang) * r)
      if (y < 92 && hash(x, y + b) < 0.55) ctx.fillRect(x, y, 1, 1)
    }
  }
  const floor = 94
  drawGround(ctx, floor, 0.28)
  for (let x = 8; x < W - 8; x += 12) {
    for (let y = floor + 2; y < H; y += 6) {
      if ((x / 12 + y / 6) % 2 < 1) ctx.fillRect(x, y, 2, 1)
    }
  }
  // DJ panda behind the decks
  const bob = Math.floor(f / 3) % 2
  const sx = Math.round(W / 2 - 22)
  const sy = floor - PANDA.length * 2 - 8 + bob
  drawPanda(ctx, PANDA, sx, sy, 2, scenePalette, { blink, step: bob as 0 | 1 })
  // headphones: a band across the crown + over-ear cups hugging each side
  // (positioned for the blob mascot — clear of the eyes at cols 5-6 / 16-17)
  ctx.fillStyle = sceneColors.ink
  for (let c = 4; c <= 19; c++) ctx.fillRect(sx + c * 2, sy + 2, 2, 2)
  for (let r = 2; r <= 7; r++) {
    ctx.fillRect(sx + 2 * 2, sy + r * 2, 2, 2)
    ctx.fillRect(sx + 21 * 2, sy + r * 2, 2, 2)
  }
  for (let x = 58; x < 134; x += 2) ctx.fillRect(x, floor - 8, 1, 1)
  ctx.fillStyle = sceneColors.eye
  ctx.fillRect(64, floor - 6, 12, 3)
  ctx.fillRect(116, floor - 6, 12, 3)
  ctx.fillStyle = sceneColors.ink
  ctx.fillRect(69 + (f % 4 < 2 ? 1 : -1), floor - 5, 2, 1)
  ctx.fillRect(121 + (f % 4 < 2 ? -1 : 1), floor - 5, 2, 1)
  drawBuddy(ctx, f, blink, wander(f, 18, 44, 1.1), floor, 3)
  drawBuddy(ctx, f + 3, blink, wander(f, 146, 172, 1.1, 26), floor, 3)
}

function sceneGarden(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = sceneColors.ink
  for (let x = 58; x <= 150; x += 2) {
    ctx.fillRect(x, 10, 1, 1)
    ctx.fillRect(x, 56, 1, 1)
  }
  for (let y = 10; y <= 56; y += 2) {
    ctx.fillRect(58, y, 1, 1)
    ctx.fillRect(150, y, 1, 1)
  }
  drawCloud(ctx, 88, 28, 9, 8)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + f / 40
    ctx.fillRect(Math.round(88 + Math.cos(a) * 13), Math.round(28 + Math.sin(a) * 12), 1, 1)
  }
  for (const [px, flip] of [[18, 1], [176, -1]] as const) {
    for (let leaf = 0; leaf < 5; leaf++) {
      const spread = (leaf - 2) * 0.35
      for (let t = 0; t < 1; t += 0.05) {
        const x = Math.round(px + flip * Math.sin(spread) * t * 26 + flip * t * t * 6)
        const y = Math.round(84 - t * (30 + leaf * 6) - Math.sin(f / 16 + leaf) * 1.5)
        if (hash(x + leaf, y) < 0.8) ctx.fillRect(x, y, 1, 1)
        if (t > 0.4 && hash(x, y + leaf) < 0.5) ctx.fillRect(x + flip, y + 1, 1, 1)
      }
    }
    for (let y = 84; y < 94; y += 2) {
      for (let x = px - 7; x <= px + 7; x += 2) if (hash(x, y) < 0.6) ctx.fillRect(x, y, 1, 1)
    }
  }
  for (let x = 156; x < 184; x += 2) ctx.fillRect(x, 30, 1, 1)
  ctx.fillRect(158, 22, 3, 8)
  ctx.fillRect(163, 24, 3, 6)
  ctx.fillRect(168, 21, 2, 9)
  ctx.fillRect(173, 25, 4, 5)
  for (let x = 34; x <= 50; x += 2) {
    ctx.fillRect(x, 20, 1, 1)
    ctx.fillRect(x, 34, 1, 1)
  }
  for (let y = 20; y <= 34; y += 2) {
    ctx.fillRect(34, y, 1, 1)
    ctx.fillRect(50, y, 1, 1)
  }
  drawCloud(ctx, 42, 27, 4, 3)
  const horizon = 92
  drawGround(ctx, horizon, 0.26)
  ctx.fillStyle = sceneColors.ink
  for (let x = 52; x < 104; x += 3) {
    ctx.fillRect(x, horizon + 4, 1, 1)
    ctx.fillRect(x + 1, horizon + 8, 1, 1)
  }
  for (let x = 108; x < 152; x += 2) ctx.fillRect(x, horizon - 18, 1, 1)
  for (let y = horizon - 18; y < horizon; y += 2) {
    ctx.fillRect(110, y, 1, 1)
    ctx.fillRect(148, y, 1, 1)
  }
  for (let y = horizon - 24; y < horizon - 19; y += 1) {
    for (let x = 124; x < 130; x += 1) if (hash(x, y) < 0.7) ctx.fillRect(x, y, 1, 1)
  }
  ctx.fillRect(131, horizon - 22, 1, 2)
  const s = f % 16
  if (s < 10) ctx.fillRect(126 + (s % 4 < 2 ? 0 : 1), horizon - 26 - s, 1, 1)
  // panda pottering near the desk (its ringed tail is part of the sprite)
  const mx = wander(f, 62, 96, 0.35)
  const moving = Math.abs(wander(f + 1, 62, 96, 0.35) - mx) > 0.05
  drawWalker(ctx, f, blink, mx, horizon, moving)
  drawButterfly(ctx, f, wander(f, 150, 180, 0.9), 50 + Math.sin(f / 6) * 5)
}

function sceneGlobe(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = sceneColors.ink
  const cx = 96
  const cy = 128
  const R = 66
  const off = f * 0.5
  for (let y = cy - R; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const dx = x - cx
      const dy = y - cy
      const d2 = dx * dx + dy * dy
      if (d2 > R * R) continue
      const edge = d2 > (R - 3) * (R - 3)
      const land = hash(Math.floor((x + off) / 9), Math.floor(y / 9)) > 0.52
      if (edge || (land && hash(x, y) < 0.7) || (!land && hash(x, y) < 0.08)) {
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }
  const oa = f / 18
  ctx.fillRect(Math.round(cx + Math.cos(oa) * 84), Math.round(62 + Math.sin(oa) * 20), 2, 2)
  ctx.fillRect(Math.round(cx + Math.cos(-oa * 1.4 + 2) * 92), Math.round(58 + Math.sin(-oa * 1.4 + 2) * 26), 1, 1)
  for (let y = -6; y <= 6; y++) {
    for (let x = -6; x <= 6; x++) {
      const inMoon = x * x + y * y <= 36
      const inBite = (x - 3) * (x - 3) + y * y <= 25
      if (inMoon && !inBite && hash(x + 300, y) < 0.8) ctx.fillRect(24 + x, 16 + y, 1, 1)
    }
  }
  for (let i = 0; i < 26; i++) {
    if (hash(i, Math.floor(f / 5)) > 0.35) {
      ctx.fillRect(Math.round(hash(i, 3) * (W - 8)) + 4, Math.round(hash(i, 5) * 46) + 4, 1, 1)
    }
  }
  // panda with sunglasses on top of the world
  const sx = cx - 22
  const sy = cy - R - PANDA_BODY_ROWS * 2 - 2
  drawSitter(ctx, false, sx, sy)
  ctx.fillStyle = sceneColors.eye
  ctx.fillRect(sx + 5 * 2, sy + 4 * 2, 5 * 2, blink ? 2 : 4)
  ctx.fillRect(sx + 15 * 2, sy + 4 * 2, 5 * 2, blink ? 2 : 4)
  ctx.fillRect(sx + 10 * 2, sy + 4 * 2, 5 * 2, 1)
}

function sceneNight(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = sceneColors.ink
  for (let i = 0; i < 56; i++) {
    if (hash(i, Math.floor(f / 6) + Math.floor(i / 7)) > 0.3) {
      ctx.fillRect(Math.round(hash(i, 11) * (W - 8)) + 4, Math.round(hash(i, 17) * 62) + 4, 1, 1)
    }
  }
  const CONST = [[26, 14], [38, 20], [50, 12], [58, 24], [72, 18]]
  for (let i = 0; i < CONST.length; i++) {
    ctx.fillRect(CONST[i][0], CONST[i][1], 2, 2)
    if (i > 0) {
      const [ax, ay] = CONST[i - 1]
      const [bx2, by2] = CONST[i]
      for (let t = 0.2; t < 1; t += 0.25) {
        ctx.fillRect(Math.round(ax + (bx2 - ax) * t), Math.round(ay + (by2 - ay) * t), 1, 1)
      }
    }
  }
  drawCloud(ctx, 152, 22, 12, 11)
  ctx.fillStyle = '#1e1e1e'
  ctx.fillRect(148, 18, 3, 3)
  ctx.fillRect(156, 26, 2, 2)
  ctx.fillStyle = sceneColors.ink
  const t = f % 108
  if (t < 10) {
    for (let k = 0; k < 5; k++) ctx.fillRect(20 + t * 6 - k * 3, 14 + t * 2 - k, 1, 1)
  }
  const horizon = 92
  drawHills(ctx, horizon, 11)
  drawGround(ctx, horizon, 0.3)
  for (let i = 0; i < 4; i++) {
    if (hash(i, Math.floor(f / 4)) > 0.4) {
      ctx.fillRect(
        Math.round(wander(f, 20, W - 20, 0.4 + i * 0.13, i * 37)),
        horizon - 16 + Math.round(Math.sin(f / 6 + i * 2) * 5),
        1, 1
      )
    }
  }
  const fx = 120
  ctx.fillStyle = sceneColors.body
  const lick = Math.floor(f / 2) % 3
  ctx.fillRect(fx, horizon - 6 - lick, 3, 4 + lick)
  ctx.fillRect(fx - 2, horizon - 3, 7, 3)
  ctx.fillStyle = sceneColors.ink
  ctx.fillRect(fx - 4, horizon - 1, 11, 1)
  const sm = f % 14
  if (sm < 10) ctx.fillRect(fx + 1 + (sm % 4 < 2 ? 1 : -1), horizon - 10 - sm, 1, 1)
  drawWalker(ctx, f, blink, 78, horizon, false)
  drawBuddy(ctx, f, blink, 140, horizon, 8)
}

function sceneRain(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = sceneColors.ink
  drawCloud(ctx, 40, 12, 30, 8)
  drawCloud(ctx, 110, 8, 34, 7)
  drawCloud(ctx, 168, 14, 22, 6)
  const horizon = 92
  for (let i = 0; i < 46; i++) {
    const rx = (hash(i, 5) * W + f * 1.2) % W
    const ry = (hash(i, 9) * H + f * 5) % (horizon - 18) + 18
    ctx.fillRect(Math.round(rx), Math.round(ry), 1, 3)
    ctx.fillRect(Math.round(rx) + 1, Math.round(ry) - 2, 1, 2)
  }
  drawGround(ctx, horizon, 0.32)
  const px = 132
  for (let x = -16; x <= 16; x += 2) {
    if (hash(x + 50, 2) < 0.7) ctx.fillRect(px + x, horizon + 6, 1, 1)
  }
  const rip = (f % 18) / 18
  const rr = Math.round(rip * 12)
  for (let a = 0; a < Math.PI * 2; a += 0.5) {
    if (rip < 0.8) ctx.fillRect(Math.round(px + Math.cos(a) * rr), Math.round(horizon + 6 + Math.sin(a) * rr * 0.3), 1, 1)
  }
  const mx = wander(f, 44, 84, 0.3)
  const moving = Math.abs(wander(f + 1, 44, 84, 0.3) - mx) > 0.05
  drawWalker(ctx, f, blink, mx, horizon, moving)
  const ux = Math.round(mx) + 21
  for (let x = -16; x <= 16; x += 2) {
    const y = -Math.round(Math.sqrt(Math.max(0, 256 - x * x)) * 0.45)
    ctx.fillRect(ux + x, horizon - 40 + y, 1, 1)
    if (hash(x, 77) < 0.5) ctx.fillRect(ux + x, horizon - 39 + y, 1, 1)
  }
  ctx.fillStyle = sceneColors.gray
  ctx.fillRect(ux, horizon - 40, 1, 14)
  drawBuddy(ctx, f, blink, px - 8 + Math.sin(f / 5) * 3, horizon + 4, 3)
}

function sceneRooftop(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = sceneColors.ink
  for (let i = 0; i < 30; i++) {
    if (hash(i, Math.floor(f / 6)) > 0.35) {
      ctx.fillRect(Math.round(hash(i, 11) * (W - 8)) + 4, Math.round(hash(i, 13) * 40) + 4, 1, 1)
    }
  }
  drawCloud(ctx, 30, 16, 9, 8)
  const towers = [
    [8, 56, 22], [36, 44, 18], [60, 62, 16], [82, 38, 24], [112, 52, 20], [138, 46, 16], [160, 58, 26]
  ]
  for (const [tx, ty, tw] of towers) {
    for (let x = tx; x <= tx + tw; x += 2) {
      ctx.fillRect(x, ty, 1, 1)
      if (hash(x, ty) < 0.3) ctx.fillRect(x, ty + 1, 1, 1)
    }
    for (let y = ty; y < 88; y += 2) {
      ctx.fillRect(tx, y, 1, 1)
      ctx.fillRect(tx + tw, y, 1, 1)
    }
    for (let wy = ty + 4; wy < 84; wy += 6) {
      for (let wx = tx + 3; wx < tx + tw - 2; wx += 5) {
        if (hash(wx, wy + Math.floor(f / 30)) > 0.55) ctx.fillRect(wx, wy, 2, 2)
      }
    }
  }
  for (let x = 0; x < W; x += 1) ctx.fillRect(x, 88, 1, 1)
  for (let y = 90; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) if (hash(x, y) < 0.3) ctx.fillRect(x, y, 1, 1)
  }
  ctx.fillRect(160, 66, 1, 22)
  ctx.fillRect(156, 72, 9, 1)
  if (Math.floor(f / 6) % 2 === 0) {
    ctx.fillStyle = sceneColors.body
    ctx.fillRect(159, 63, 3, 3)
    ctx.fillStyle = sceneColors.ink
  }
  drawSitter(ctx, blink, 66, 88 - PANDA_BODY_ROWS * 2 + (Math.floor(f / 8) % 2))
  drawBuddy(ctx, f, blink, 104, 88 + 2, 8)
  const t = f % 130
  if (t < 80) drawBird(ctx, W - t * 2.6, 30 + Math.sin(t / 6) * 4, Math.floor(t / 3) % 2 === 0)
}

// burnout nap: the panda curls up under the moon to nudge you toward a break
function sceneNap(ctx: Ctx, f: number, _blink: boolean): void {
  ctx.fillStyle = sceneColors.ink
  for (let i = 0; i < 22; i++) {
    if (hash(i, Math.floor(f / 8)) > 0.45) {
      ctx.fillRect(Math.round(hash(i, 11) * (W - 8)) + 4, Math.round(hash(i, 17) * 50) + 4, 1, 1)
    }
  }
  // crescent moon
  for (let y = -8; y <= 8; y++) {
    for (let x = -8; x <= 8; x++) {
      const inMoon = x * x + y * y <= 64
      const inBite = (x - 4) * (x - 4) + y * y <= 49
      if (inMoon && !inBite && hash(x + 500, y) < 0.85) ctx.fillRect(158 + x, 20 + y, 1, 1)
    }
  }
  const horizon = 92
  drawHills(ctx, horizon, 8)
  drawGround(ctx, horizon, 0.24)
  // rug
  ctx.fillStyle = sceneColors.ink
  for (let x = 70; x < 126; x += 3) {
    ctx.fillRect(x, horizon + 2, 1, 1)
    ctx.fillRect(x + 1, horizon + 5, 1, 1)
  }
  // curled panda: body mound + ears + ringed tail wrapped around the front
  const cx = 96
  const breathe = Math.floor(f / 10) % 2
  ctx.fillStyle = scenePalette.body
  for (let y = -8 - breathe; y <= 0; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - (y / (8 + breathe)) ** 2)) * 15)
    ctx.fillRect(cx - half, horizon - 1 + y, half * 2, 1)
  }
  ctx.fillStyle = scenePalette.dark
  ctx.fillRect(cx - 12, horizon - 10 - breathe, 2, 2) // ear
  ctx.fillRect(cx - 8, horizon - 11 - breathe, 2, 2) // ear
  // tail rings wrapping the front
  const rings = [scenePalette.dark, scenePalette.ink, scenePalette.dark, scenePalette.ink, scenePalette.dark]
  rings.forEach((col, i) => {
    ctx.fillStyle = col
    ctx.fillRect(cx - 10 + i * 5, horizon - 3, 5, 3)
  })
  // closed eye + Zzz
  ctx.fillStyle = scenePalette.eye
  ctx.fillRect(cx - 9, horizon - 7 - breathe, 3, 1)
  ctx.fillStyle = sceneColors.ink
  const z = Math.floor(f / 8) % 3
  ctx.fillRect(cx + 14 + z * 4, horizon - 16 - z * 4, 3, 1)
  ctx.fillRect(cx + 15 + z * 4, horizon - 15 - z * 4, 1, 1)
  ctx.fillRect(cx + 14 + z * 4, horizon - 14 - z * 4, 3, 1)
  // gentle nudge, terminal-dim, crisp bitmap pixels
  drawPixelText(ctx, 'TAKE A BREAK · NOTHING DONE IN 90M', cx, H - 9, { color: sceneColors.gray, align: 'center' })
}

// name-keyed registry: config references names, not fragile array indices.
// horizon = walkable ground line for loot props (undefined = no ground scene).
const SCENE_REGISTRY: Record<string, SceneDef> = {
  meadow: { name: 'meadow', draw: sceneMeadow, horizon: 90 },
  surf: { name: 'surf', draw: sceneSurf },
  garden: { name: 'garden', draw: sceneGarden, horizon: 92 },
  disco: { name: 'disco', draw: sceneDisco, horizon: 94 },
  globe: { name: 'globe', draw: sceneGlobe },
  night: { name: 'night', draw: sceneNight, horizon: 92 },
  rain: { name: 'rain', draw: sceneRain, horizon: 92 },
  rooftop: { name: 'rooftop', draw: sceneRooftop, horizon: 88 },
  nap: { name: 'nap', draw: sceneNap }
}
export const SCENE_NAMES = Object.keys(SCENE_REGISTRY)
const TRANS_FRAMES = 30 // ~2.5s: dissolve out → loading beat → dissolve in

// chunky ordered pixel dissolve: replace an `amount` (0..1) fraction of 4px
// blocks of `ctx` with the matching blocks from `src`. Shared by the scene
// transition and the scene⇄constellation composite.
function ditherBlocks(ctx: Ctx, src: HTMLCanvasElement, amount: number): void {
  const B = 4
  for (let by = 0; by < H / B; by++) {
    for (let bx = 0; bx < W / B; bx++) {
      if (hash(bx, by) < amount) {
        ctx.clearRect(bx * B, by * B, B, B)
        ctx.drawImage(src, bx * B, by * B, B, B, bx * B, by * B, B, B)
      }
    }
  }
}

// the loading beat: the blob centered, "working" (a bob + alternating foot
// tap via the gait step), with 1–3 cycling dots underneath
function drawLoading(ctx: Ctx, f: number): void {
  ctx.clearRect(0, 0, W, H)
  const bob = Math.floor(f / 3) % 2
  const cw = PANDA[0].length * 2
  const ch = PANDA.length * 2
  const sx = Math.round(W / 2 - cw / 2)
  const sy = Math.round(H / 2 - ch / 2) - 4 + bob
  drawPanda(ctx, PANDA, sx, sy, 2, scenePalette, { blink: false, step: bob as 0 | 1 })
  const n = 1 + (Math.floor(f / 4) % 3) // · ·· ···
  const gap = 6
  let dx = Math.round(W / 2 - ((n - 1) * gap) / 2)
  const dotY = sy + ch + 6
  ctx.fillStyle = sceneColors.ink
  for (let i = 0; i < n; i++) {
    ctx.fillRect(dx - 1, dotY, 2, 2)
    dx += gap
  }
}

// Loading-interstitial transition: dissolve the frozen outgoing scene out to
// the loading beat, hold it, then dissolve the live incoming scene in.
function drawLoadingTransition(
  ctx: Ctx,
  fromBuf: HTMLCanvasElement,
  toBuf: HTMLCanvasElement,
  loadBuf: HTMLCanvasElement,
  fromCtx: Ctx,
  toCtx: Ctx,
  loadCtx: Ctx,
  fromDraw: SceneFn,
  toDraw: SceneFn,
  frozenF: number,
  liveF: number,
  blink: boolean,
  t: number
): void {
  const { phase, mix } = loadingPhase(t)
  ctx.clearRect(0, 0, W, H)
  if (phase === 'hold') {
    drawLoading(ctx, liveF)
    return
  }
  drawLoading(loadCtx, liveF)
  if (phase === 'out') {
    // outgoing scene frozen at its last frame, dissolving toward loading
    fromCtx.clearRect(0, 0, W, H)
    fromDraw(fromCtx, frozenF, false)
    ctx.drawImage(fromBuf, 0, 0)
    ditherBlocks(ctx, loadBuf, mix)
  } else {
    // loading dissolving toward the live incoming scene
    toCtx.clearRect(0, 0, W, H)
    toDraw(toCtx, liveF, blink)
    ctx.drawImage(loadBuf, 0, 0)
    ditherBlocks(ctx, toBuf, mix)
  }
}

// --- constellation graph state -------------------------------------------

// star-chart palette: three depths of ink so the sky recedes properly
const FAR = '#43423b'
const CHART = '#54534a'
const DARKPULSE = '#b85c3f'

function drawGraph(
  ctx: Ctx,
  stars: Star[],
  edges: [number, number][],
  f: number,
  focusRel: string | null,
  hover: number
): void {
  const focus = stars.find((s) => s.ring === 0)
  const focused = focusRel !== null && !!focus

  // --- deep sky: two parallax layers + the odd shooting star ---
  for (let i = 0; i < 26; i++) {
    if (hash(i, Math.floor(f / 9)) > 0.35) {
      ctx.fillStyle = FAR
      ctx.fillRect(Math.round(hash(i, 31) * (W - 6)) + 3, Math.round(hash(i, 37) * (H - 24)) + 3, 1, 1)
    }
  }
  for (let i = 0; i < 10; i++) {
    if (hash(i + 60, Math.floor(f / 5)) > 0.45) {
      ctx.fillStyle = sceneColors.gray
      ctx.fillRect(Math.round(hash(i + 60, 13) * (W - 8)) + 4, Math.round(hash(i + 60, 17) * (H - 30)) + 4, 1, 1)
    }
  }
  const shoot = f % 150
  if (shoot < 9) {
    ctx.fillStyle = sceneColors.ink
    for (let k = 0; k < 4; k++) ctx.fillRect(130 + shoot * 5 - k * 3, 10 + shoot * 2 - k, 1, 1)
  }

  // --- chart furniture: corner brackets + faint crosshair marks ---
  ctx.fillStyle = CHART
  for (const [cx2, cy2, sx, sy] of [[2, 2, 1, 1], [W - 3, 2, -1, 1], [2, H - 3, 1, -1], [W - 3, H - 3, -1, -1]] as const) {
    ctx.fillRect(cx2, cy2, sx * 4, 1)
    ctx.fillRect(cx2, cy2, 1, sy * 4)
  }
  for (let i = 0; i < 3; i++) {
    const mx = 14 + Math.round(hash(i, 91) * (W - 28))
    const my = 12 + Math.round(hash(i, 97) * (H - 40))
    ctx.fillRect(mx - 2, my, 5, 1)
    ctx.fillRect(mx, my - 2, 1, 5)
  }

  // --- orbit guide: dotted ellipse where the neighbors ride ---
  if (focused && focus) {
    ctx.fillStyle = CHART
    for (let a = 0; a < 32; a++) {
      if ((a + Math.floor(f / 6)) % 2) continue // slow counter-rotation
      const t = (a / 32) * Math.PI * 2
      ctx.fillRect(Math.round(focus.x + Math.cos(t) * W * 0.27), Math.round(focus.y + Math.sin(t) * H * 0.27), 1, 1)
    }
  }

  // --- links: focus links get a dotted rail + a traveling clay pulse ---
  for (const [a, b] of edges) {
    let s1 = stars[a]
    let s2 = stars[b]
    const isFocusEdge = s1.ring === 0 || s2.ring === 0
    if (s2.ring === 0) [s1, s2] = [s2, s1] // pulse flows away from the focus
    const dx = s2.x - s1.x
    const dy = s2.y - s1.y
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    const steps = Math.max(4, Math.floor(len / 3))
    ctx.fillStyle = isFocusEdge ? sceneColors.gray : focused ? FAR : CHART
    for (let s = 1; s < steps; s++) {
      if (s % 2 === 0) continue
      ctx.fillRect(Math.round(s1.x + (dx * s) / steps), Math.round(s1.y + (dy * s) / steps), 1, 1)
    }
    if (isFocusEdge) {
      // the pulse: a 2px clay packet with a fading tail, looping outward
      const head = ((f * 1.5) % (len + 10)) / len
      for (let k = 0; k < 3; k++) {
        const t = head - k * 0.07
        if (t < 0 || t > 1) continue
        ctx.fillStyle = k === 0 ? sceneColors.body : DARKPULSE
        const px = Math.round(s1.x + dx * t)
        const py = Math.round(s1.y + dy * t)
        ctx.fillRect(px - (k === 0 ? 1 : 0), py - (k === 0 ? 1 : 0), k === 0 ? 2 : 1, k === 0 ? 2 : 1)
      }
    }
  }

  // --- stars ---
  const starburst = (x: number, y: number, color: string, big: boolean): void => {
    ctx.fillStyle = color
    if (big) {
      ctx.fillRect(x - 1, y - 1, 3, 3)
      for (const [ax, ay] of [[-3, 0], [3, 0], [0, -3], [0, 3]] as const) {
        ctx.fillRect(x + ax, y + ay, 1, 1)
        ctx.fillRect(x + (ax ? ax / 3 : 0) * 2, y + (ay ? ay / 3 : 0) * 2, 1, 1)
      }
    } else {
      ctx.fillRect(x, y, 1, 1)
      ctx.fillRect(x - 1, y, 3, 1)
      ctx.fillRect(x, y - 1, 1, 3)
    }
  }

  let labeled = 0
  const placedLabels: { x0: number; x1: number; y0: number; y1: number }[] = []
  stars.forEach((s, i) => {
    const isFocus = s.ring === 0
    const isHover = i === hover && !isFocus
    if (isFocus) return // drawn last, on top
    if (!isHover && hash(i, Math.floor(f / 5)) < (s.ring === 3 && focused ? 0.3 : 0.06)) return
    if (s.ring === 3) {
      ctx.fillStyle = focused ? CHART : s.node.links >= 2 ? sceneColors.ink : sceneColors.gray
      const sz = !focused && s.node.links >= 2 ? 2 : 1
      ctx.fillRect(s.x, s.y, sz, sz)
    } else if (s.ring === 2) {
      ctx.fillStyle = sceneColors.gray
      ctx.fillRect(s.x, s.y - 1, 1, 3)
      ctx.fillRect(s.x - 1, s.y, 3, 1)
    } else {
      starburst(s.x, s.y, isHover ? sceneColors.body : sceneColors.ink, false)
    }
    if (isHover) starburst(s.x, s.y, sceneColors.body, true)
    // neighbors wear their names — crisp bitmap pixels, placed outward
    // from the focus, then bumped down a line whenever boxes collide
    if ((s.ring === 1 && labeled < 6) || isHover) {
      labeled++
      const name = s.node.title.slice(0, 12)
      const tw = measurePixelText(name)
      let placeRight = s.x >= (focus?.x ?? W / 2)
      if (placeRight && s.x + 5 + tw > W - 2) placeRight = false
      if (!placeRight && s.x - 5 - tw < 2) placeRight = true
      const x0 = placeRight ? s.x + 5 : s.x - 5 - tw
      const x1 = x0 + tw
      let ly = Math.max(3, Math.min(H - 22, s.y - 2))
      let guard = 0
      while (
        guard++ < 4 &&
        placedLabels.some((p) => x0 < p.x1 + 3 && x1 > p.x0 - 3 && ly < p.y1 + 2 && ly + 5 > p.y0 - 2)
      ) {
        ly += 8
      }
      placedLabels.push({ x0, x1, y0: ly, y1: ly + 5 })
      drawPixelText(ctx, name, placeRight ? s.x + 5 : s.x - 5, ly, {
        color: isHover ? sceneColors.body : sceneColors.gray,
        align: placeRight ? 'left' : 'right'
      })
    }
  })

  // --- the focused star: clay starburst + dither glow + rotating ring ---
  if (focus) {
    for (let gy = -6; gy <= 6; gy++) {
      for (let gx = -6; gx <= 6; gx++) {
        const d = gx * gx + gy * gy
        if (d > 12 && d <= 36 && hash(gx + 200, gy + Math.floor(f / 3)) < 0.16) {
          ctx.fillStyle = DARKPULSE
          ctx.fillRect(focus.x + gx, focus.y + gy, 1, 1)
        }
      }
    }
    starburst(focus.x, focus.y, sceneColors.body, true)
    const ra = f / 9
    ctx.fillStyle = sceneColors.body
    for (let k = 0; k < 4; k++) {
      const t = ra + (k * Math.PI) / 2
      ctx.fillRect(Math.round(focus.x + Math.cos(t) * 7), Math.round(focus.y + Math.sin(t) * 7), 1, 1)
    }
  }

  // --- chart legend: crisp pixel type, quiet hierarchy (color, not size) ---
  drawPixelText(ctx, 'STAR CHART', 8, 4, { color: CHART })
  drawPixelText(ctx, focused ? 'CLICK CENTER TO OPEN' : 'CLICK A STAR TO FOCUS', 8, 11, { color: FAR })
  drawPixelText(ctx, `${stars.length} NOTES · ${edges.length} LINKS`, W - 8, 4, { color: CHART, align: 'right' })
  const title = focus ?? (hover >= 0 ? stars[hover] : undefined)
  if (title) {
    const name = title.node.title.slice(0, 26)
    const links = ` · ${title.node.links} LINKS`
    const tw = measurePixelText(name)
    const lw = measurePixelText(links)
    const x0 = Math.round(W / 2 - (tw + lw) / 2)
    drawPixelText(ctx, name, x0, H - 12, { color: sceneColors.ink })
    drawPixelText(ctx, links, x0 + tw, H - 12, { color: sceneColors.gray })
    // dotted underline gives the nameplate a cartographic feel
    ctx.fillStyle = CHART
    for (let x = 0; x < tw + lw + 8; x += 2) ctx.fillRect(x0 - 4 + x, H - 4, 1, 1)
  }
}

export function CoreScene({
  usagePercent,
  busy,
  mood,
  loot,
  graph,
  chart,
  scenes,
  customScenes,
  sprites,
  maxWidth = 560
}: {
  usagePercent: number
  busy: boolean
  mood: Mood
  loot: string[]
  graph: LinkGraph
  chart: boolean
  scenes?: SceneConfig
  customScenes?: CustomScene[]
  sprites: CustomSprite[]
  maxWidth?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const usageRef = useRef(usagePercent)
  usageRef.current = usagePercent
  const moodRef = useRef(mood)
  moodRef.current = mood
  const lootRef = useRef(loot)
  lootRef.current = loot
  const graphRef = useRef(graph)
  graphRef.current = graph
  const chartRef = useRef(chart)
  chartRef.current = chart
  // user-authored scenes merge into the name-keyed registry so they rotate /
  // busy / nap exactly like the built-ins (fail-soft; parity when none)
  const spritesByName = useMemo(() => new Map((sprites ?? []).map((s) => [s.name, s.grid])), [sprites])
  const customList = useMemo(
    () => resolveCustomScenes(customScenes, new Set(spritesByName.keys()), new Set(SCENE_NAMES)),
    [customScenes, spritesByName]
  )
  const registry = useMemo(
    () => ({
      ...SCENE_REGISTRY,
      ...Object.fromEntries(
        customList.map((s) => [
          s.name,
          { name: s.name, horizon: Math.round(H * 0.78), draw: (c: Ctx, f: number) => drawCustomScene(c, s, spritesByName, f, W, H) }
        ])
      )
    }),
    [customList, spritesByName]
  )
  const registryRef = useRef(registry)
  registryRef.current = registry
  const scn = resolveScenes(scenes, Object.keys(registry), ROTATION_DEFAULT, FPS)
  const scnRef = useRef(scn)
  scnRef.current = scn

  // constellation reveal state — driven by Second Brain hover events and by
  // the pointer being over the canvas itself (so you can travel to a star)
  const focusRef = useRef<string | null>(null)
  const focusUntil = useRef(0)
  const overCanvas = useRef(false)
  const hoverStarRef = useRef(-1)
  const starsRef = useRef<{ stars: Star[]; edges: [number, number][] }>({ stars: [], edges: [] })

  // mount the loop exactly once — prop changes must never reset the frame
  // counter or the scene rotation restarts from meadow on every usage tick
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const sceneOff = document.createElement('canvas')
    sceneOff.width = W
    sceneOff.height = H
    const sctx = sceneOff.getContext('2d')!
    const graphOff = document.createElement('canvas')
    graphOff.width = W
    graphOff.height = H
    const gctx = graphOff.getContext('2d')!
    // scratch buffers for the loading-interstitial transition
    const bufFrom = document.createElement('canvas')
    bufFrom.width = W
    bufFrom.height = H
    const cFrom = bufFrom.getContext('2d')!
    const bufTo = document.createElement('canvas')
    bufTo.width = W
    bufTo.height = H
    const cTo = bufTo.getContext('2d')!
    const bufLoad = document.createElement('canvas')
    bufLoad.width = W
    bufLoad.height = H
    const cLoad = bufLoad.getContext('2d')!

    let raf = 0
    let lastFrame = -1
    let dissolve = 0 // 0 = scene · 1 = graph
    // stars glide toward their layout targets when the focus re-centers
    const glide = new Map<string, { x: number; y: number }>()
    const start = performance.now()

    const onReveal = (e: Event): void => {
      const rel = (e as CustomEvent).detail as string | null
      if (rel) {
        focusRef.current = rel
        focusUntil.current = Infinity
      } else {
        // grace period so the pointer can travel from the note to the canvas
        focusUntil.current = performance.now() + 1400
      }
    }
    window.addEventListener('vault:constellation', onReveal)

    const loop = (now: number): void => {
      const tf = ((now - start) / 1000) * FPS
      const frame = Math.floor(tf)

      // --- state machine: scene ⇄ constellation ---
      // sticky CHART mode keeps the sky up for browsing; otherwise a note
      // hover summons it and the pointer resting on the canvas only KEEPS
      // it open (so you can travel to a star and click it)
      const wantGraph =
        (chartRef.current || focusUntil.current > now || (overCanvas.current && dissolve > 0)) &&
        graphRef.current.nodes.length > 0
      if (!wantGraph && focusUntil.current <= now) focusRef.current = null
      const target = wantGraph ? 1 : 0
      const dStep = 0.09 // ~0.7s chunky pixel dissolve at 60fps
      dissolve = Math.max(0, Math.min(1, dissolve + (target > dissolve ? dStep : dissolve > target ? -dStep : 0)))
      canvas.style.cursor = dissolve > 0.9 && hoverStarRef.current >= 0 ? 'pointer' : 'default'

      // --- render the active scene into its offscreen (12fps stepping) ---
      const sceneFrames = scnRef.current.intervalFrames
      const rot = scnRef.current.rotation
      const slot = Math.floor(frame / sceneFrames)
      const entry = busyRef.current ? registryRef.current[scnRef.current.busy] : registryRef.current[rot[slot % rot.length]]
      const napping = !busyRef.current && moodRef.current === 'napping'
      const inScene = tf - slot * sceneFrames
      if (dissolve < 1) {
        if (!napping && inScene < TRANS_FRAMES && slot > 0 && !busyRef.current) {
          const prevEntry = registryRef.current[rot[(slot - 1) % rot.length]]
          const blinkEvery = usageRef.current > 80 ? 24 : 48
          const frozenF = slot * sceneFrames - 1 // last frame of the outgoing scene
          drawLoadingTransition(
            sctx,
            bufFrom,
            bufTo,
            bufLoad,
            cFrom,
            cTo,
            cLoad,
            prevEntry.draw,
            entry.draw,
            frozenF,
            frame,
            frame % blinkEvery >= blinkEvery - 6,
            inScene / TRANS_FRAMES
          )
          lastFrame = -1
        } else if (frame !== lastFrame) {
          const blinkEvery = usageRef.current > 80 ? 24 : 48
          sctx.clearRect(0, 0, W, H)
          if (napping) {
            registryRef.current[scnRef.current.nap].draw(sctx, frame, false)
          } else {
            entry.draw(sctx, frame, frame % blinkEvery >= blinkEvery - 6)
            if (entry.horizon !== undefined) drawLoot(sctx, lootRef.current, entry.horizon, frame)
          }
          lastFrame = frame
        }
      }

      // --- render the graph into its offscreen when visible ---
      if (dissolve > 0) {
        const layout = layoutConstellation(graphRef.current, W, H, focusRef.current)
        // ease every star toward its slot — re-centering feels like the
        // constellation re-arranging itself around the hovered note
        const shown = layout.stars.map((s) => {
          const cur = glide.get(s.node.relPath) ?? { x: s.x, y: s.y }
          cur.x += (s.x - cur.x) * 0.25
          cur.y += (s.y - cur.y) * 0.25
          glide.set(s.node.relPath, cur)
          return { ...s, x: Math.round(cur.x), y: Math.round(cur.y) }
        })
        starsRef.current = { stars: shown, edges: layout.edges }
        gctx.clearRect(0, 0, W, H)
        drawGraph(gctx, shown, layout.edges, frame, focusRef.current, hoverStarRef.current)
      } else {
        glide.clear() // next reveal starts fresh from layout targets
        // no live stars while the scene shows — stale hits must not
        // re-summon the graph from a bare canvas hover
        if (starsRef.current.stars.length) starsRef.current = { stars: [], edges: [] }
      }

      // --- composite: chunky ordered pixel dissolve between the states ---
      ctx.clearRect(0, 0, W, H)
      if (dissolve <= 0) {
        ctx.drawImage(sceneOff, 0, 0)
      } else if (dissolve >= 1) {
        ctx.drawImage(graphOff, 0, 0)
      } else {
        ctx.drawImage(sceneOff, 0, 0)
        ditherBlocks(ctx, graphOff, dissolve)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('vault:constellation', onReveal)
    }
  }, [])

  // canvas-space pointer math (the canvas is CSS-scaled)
  const toCanvas = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H }
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <canvas
        ref={ref}
        width={W}
        height={H}
        onMouseEnter={() => (overCanvas.current = true)}
        onMouseLeave={() => {
          overCanvas.current = false
          hoverStarRef.current = -1
        }}
        onMouseMove={(e) => {
          // hover only highlights + labels — the sky must hold still while
          // you aim (re-centering on hover made stars flee the cursor)
          const { x, y } = toCanvas(e)
          hoverStarRef.current = hitStar(starsRef.current.stars, x, y)
        }}
        onClick={(e) => {
          // click a star to pull its neighborhood to the center; click the
          // centered star again to open the note in the OS default editor
          const { x, y } = toCanvas(e)
          const i = hitStar(starsRef.current.stars, x, y)
          if (i < 0) return
          const star = starsRef.current.stars[i]
          if (star.ring === 0) {
            window.vault.openDoc(star.node.relPath)
          } else {
            focusRef.current = star.node.relPath
            focusUntil.current = performance.now() + 2500
          }
        }}
        style={{ width: '100%', maxWidth, imageRendering: 'pixelated', aspectRatio: '16/9' }}
      />
    </div>
  )
}
