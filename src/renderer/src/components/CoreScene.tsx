import { useEffect, useRef } from 'react'

// Halftone scene engine, Claude FM style: six rotating scenes, small clay
// critter with friends, ink dots on the terminal ground.
const W = 192
const H = 108
const INK = '#e8e6e3'
const BODY = '#d97757'
const DARK = '#b85c3f'
const BODY_LIGHT = '#e8a284'
const EYE = '#17160f'
const GRAY = '#9a9a9a'

const FPS = 12
const SCENE_FRAMES = 22 * FPS
const STATIC_FRAMES = 4

// 22x14 critter (drawn at cell=2 → 44x28 px, small like the references)
const SPRITE = [
  '..nn..............nn..',
  '..nnBBBBBBBBBBBBBBnn..',
  '..BBBBBBBBBBBBBBBBDD..',
  '.BBBBBBBBBBBBBBBBBBDD.',
  '.BBEEBBBBBBBBBBEEBBDD.',
  '.BBEEBBBBBBBBBBEEBBDD.',
  '.BBBBBBBBBBBBBBBBBBDD.',
  '.BBBBBBBBBBBBBBBBBBDD.',
  '.BBBBBBBBBBBBBBBBBBDD.',
  '..BBBBBBBBBBBBBBBBDD..',
  '..BBBBBBBBBBBBBBBBDD..',
  '...BBBBBBBBBBBBBBDD...',
  '...LL..LL....LL..LL...',
  '...LL..LL....LL..LL...'
]
const CELL = 2

const BUDDY = [
  '.BBBBBB.',
  'BBBBBBBB',
  'BEBBBBEB',
  'BBBBBBBB',
  '.L.LL.L.'
]

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

function drawSprite(ctx: Ctx, rows: string[], sx: number, sy: number, cell: number, blink: boolean, step?: 0 | 1, shades = true): void {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c]
      if (ch === '.') continue
      if (step !== undefined && ch === 'L' && r === rows.length - 1) {
        if (step === 1 && c < rows[r].length / 2) continue
        if (step === 0 && c >= rows[r].length / 2) continue
      }
      ctx.fillStyle =
        ch === 'E' ? (blink ? BODY : EYE) : (ch === 'D' || ch === 'n') && shades ? DARK : BODY
      ctx.fillRect(sx + c * cell, sy + r * cell, cell, cell)
    }
  }
}

function drawWalker(ctx: Ctx, f: number, blink: boolean, x: number, groundY: number, moving: boolean): void {
  const bob = moving ? (Math.floor(f / 3) % 2) : (Math.floor(f / 8) % 2)
  drawSprite(ctx, SPRITE, Math.round(x), groundY - 28 + bob, CELL, blink, bob as 0 | 1)
}

function drawBuddy(ctx: Ctx, f: number, blink: boolean, x: number, groundY: number, hopBeat = 4): void {
  const hop = Math.floor(f / hopBeat) % 3 === 0 ? -2 : 0
  drawSprite(ctx, BUDDY, Math.round(x), groundY - 10 + hop, 2, blink)
}

function drawCloud(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.fillStyle = INK
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
  ctx.fillStyle = INK
  for (let y = horizon; y < H; y += 2) {
    const t = (y - horizon) / (H - horizon)
    const density = 0.07 + t * (maxDensity - 0.07)
    for (let x = 0; x < W; x += 2) {
      if (hash(x, y) < density) ctx.fillRect(x, y, 1, 1)
    }
  }
}

function drawBird(ctx: Ctx, x: number, y: number, flap: boolean): void {
  ctx.fillStyle = INK
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
  ctx.fillStyle = INK
  const open = Math.floor(f / 2) % 2 === 0
  ctx.fillRect(Math.round(x) - (open ? 2 : 1), Math.round(y), open ? 2 : 1, 1)
  ctx.fillRect(Math.round(x) + 1, Math.round(y), open ? 2 : 1, 1)
}

function drawHills(ctx: Ctx, horizon: number, seed: number): void {
  ctx.fillStyle = INK
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
  ctx.fillStyle = INK
  const sway = Math.floor(f / 8) % 2
  ctx.fillRect(x + sway, y - 4, 1, 1)
  ctx.fillRect(x - 1 + sway, y - 3, 3, 1)
  ctx.fillRect(x + sway, y - 2, 1, 1)
  ctx.fillRect(x, y - 1, 1, 1)
}

// --- scenes ------------------------------------------------------------

function sceneMeadow(ctx: Ctx, f: number, blink: boolean): void {
  const drift = (f * 0.35) % (W + 120)
  drawCloud(ctx, ((30 + drift) % (W + 120)) - 60, 18, 32, 10)
  drawCloud(ctx, ((140 + drift * 0.6) % (W + 120)) - 60, 34, 22, 7)
  drawCloud(ctx, ((90 + drift * 0.45) % (W + 120)) - 60, 10, 18, 5)
  // dot sun, top right
  drawCloud(ctx, 168, 14, 8, 7)
  const horizon = 90
  drawHills(ctx, horizon, 5)
  drawGround(ctx, horizon)
  // tufts of dot grass + flowers
  ctx.fillStyle = INK
  for (let i = 0; i < 14; i++) {
    const gx = Math.round(hash(i, 3) * (W - 10)) + 5
    ctx.fillRect(gx, horizon - 2, 1, 2)
    ctx.fillRect(gx + 2, horizon - 1, 1, 1)
  }
  for (let i = 0; i < 5; i++) {
    drawFlower(ctx, Math.round(hash(i, 21) * (W - 20)) + 10, horizon + Math.round(hash(i, 23) * 8), f + i * 3)
  }
  // critter and buddy both wander
  const mx = wander(f, 40, 120, 0.5)
  const moving = Math.abs(wander(f + 1, 40, 120, 0.5) - mx) > 0.1
  drawWalker(ctx, f, blink, mx, horizon, moving)
  drawBuddy(ctx, f, blink, wander(f, 130, 168, 0.8, 60), horizon, 3)
  // bird + butterfly
  const t = f % 110
  if (t < 68) drawBird(ctx, -6 + t * 3, 24 + Math.sin(t / 4) * 4, Math.floor(t / 3) % 2 === 0)
  drawButterfly(ctx, f, wander(f, 20, 60, 1.3), 60 + Math.sin(f / 5) * 6)
}

function sceneSurf(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
  // sun + gulls + a distant sail
  drawCloud(ctx, 26, 16, 9, 8)
  const g = f % 90
  if (g < 60) drawBird(ctx, W - g * 2.4, 18 + Math.sin(g / 5) * 3, Math.floor(g / 3) % 2 === 0)
  drawBird(ctx, 52 + Math.sin(f / 9) * 4, 30, Math.floor(f / 4) % 2 === 0)
  for (let k = 0; k < 6; k++) ctx.fillRect(16 + k, 88 - k, 1, 1) // sail
  ctx.fillRect(13, 89, 8, 1)
  // big swell peaking right of center: steep face on the left, long back
  const surface = (x: number): number => {
    const sigma = x < 146 ? 34 : 70
    return 102 - 66 * Math.exp(-((x - 146) ** 2) / (2 * sigma * sigma))
  }
  // water dots scroll left so the wave visibly flows
  const flow = Math.floor(f * 1.6)
  for (let x = 0; x < W; x += 2) {
    const top = surface(x)
    // foam edge shimmers along the crest
    if (hash(x + flow, 999) < 0.75) ctx.fillRect(x, Math.round(top), 1, 1)
    for (let y = Math.round(top) + 2; y < H; y += 2) {
      const depth = (y - top) / (H - top)
      if (hash(x + flow, y) < 0.1 + depth * 0.42) ctx.fillRect(x, y, 1, 1)
    }
  }
  // dense water band at the bottom, drifting slower
  for (let y = 98; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) if (hash(x + Math.floor(f * 0.8), y + 7) < 0.55) ctx.fillRect(x, y, 1, 1)
  }
  // curl hooking left off the peak (bezier from crest down-left)
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
  // spray flecks off the curl
  for (let i = 0; i < 10; i++) {
    const sx = 104 + Math.round(hash(i, Math.floor(f / 2)) * 52)
    const sy = 18 + Math.round(hash(i + 40, Math.floor(f / 2)) * 24)
    ctx.fillRect(sx, sy, 1, 1)
  }
  // rider on the face, left of the curl — board planted on the wave surface
  const mx = 96 + Math.sin(f / 10) * 8
  let surfY = H
  for (let x = mx - 4; x <= mx + 50; x += 4) surfY = Math.min(surfY, surface(x))
  // the rider rises and dips with the swell
  const boardY = Math.round(surfY + 1 + Math.sin(f / 6) * 3.5)
  ctx.fillStyle = BODY_LIGHT
  ctx.fillRect(Math.round(mx - 4), boardY, 54, 3)
  drawSprite(ctx, SPRITE.slice(0, 12), Math.round(mx), boardY - 24, CELL, blink)
}

function sceneDisco(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
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
  // sweeping light beams from the ball
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
  // dance floor tile corners
  for (let x = 8; x < W - 8; x += 12) {
    for (let y = floor + 2; y < H; y += 6) {
      if ((x / 12 + y / 6) % 2 < 1) ctx.fillRect(x, y, 2, 1)
    }
  }
  // DJ critter behind the decks
  const bob = Math.floor(f / 3) % 2
  const sx = Math.round(W / 2 - 22)
  const sy = floor - 28 - 8 + bob
  drawSprite(ctx, SPRITE, sx, sy, CELL, blink, bob as 0 | 1)
  // headphones
  ctx.fillStyle = INK
  for (let c = 4; c < 18; c++) ctx.fillRect(sx + c * CELL, sy - CELL, CELL, CELL)
  for (let r = 2; r < 6; r++) {
    ctx.fillRect(sx - CELL, sy + r * CELL, CELL + 1, CELL)
    ctx.fillRect(sx + 21 * CELL, sy + r * CELL, CELL + 1, CELL)
  }
  // deck table + spinning platters
  for (let x = 58; x < 134; x += 2) ctx.fillRect(x, floor - 8, 1, 1)
  ctx.fillStyle = EYE
  ctx.fillRect(64, floor - 6, 12, 3)
  ctx.fillRect(116, floor - 6, 12, 3)
  ctx.fillStyle = INK
  ctx.fillRect(69 + (f % 4 < 2 ? 1 : -1), floor - 5, 2, 1)
  ctx.fillRect(121 + (f % 4 < 2 ? -1 : 1), floor - 5, 2, 1)
  // two buddies dancing, out of phase
  drawBuddy(ctx, f, blink, wander(f, 18, 44, 1.1), floor, 3)
  drawBuddy(ctx, f + 3, blink, wander(f, 146, 172, 1.1, 26), floor, 3)
}

function sceneGarden(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
  // window frame
  for (let x = 58; x <= 150; x += 2) {
    ctx.fillRect(x, 10, 1, 1)
    ctx.fillRect(x, 56, 1, 1)
  }
  for (let y = 10; y <= 56; y += 2) {
    ctx.fillRect(58, y, 1, 1)
    ctx.fillRect(150, y, 1, 1)
  }
  // dot sun with rays
  drawCloud(ctx, 88, 28, 9, 8)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + f / 40
    ctx.fillRect(Math.round(88 + Math.cos(a) * 13), Math.round(28 + Math.sin(a) * 12), 1, 1)
  }
  // big plants: arcs of dot fronds from each pot
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
  // hanging shelf with books, right of the window
  for (let x = 156; x < 184; x += 2) ctx.fillRect(x, 30, 1, 1)
  ctx.fillRect(158, 22, 3, 8)
  ctx.fillRect(163, 24, 3, 6)
  ctx.fillRect(168, 21, 2, 9)
  ctx.fillRect(173, 25, 4, 5)
  // picture frame, left of the window
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
  // rug under the critter
  ctx.fillStyle = INK
  for (let x = 52; x < 104; x += 3) {
    ctx.fillRect(x, horizon + 4, 1, 1)
    ctx.fillRect(x + 1, horizon + 8, 1, 1)
  }
  // desk with a mug
  for (let x = 108; x < 152; x += 2) ctx.fillRect(x, horizon - 18, 1, 1)
  for (let y = horizon - 18; y < horizon; y += 2) {
    ctx.fillRect(110, y, 1, 1)
    ctx.fillRect(148, y, 1, 1)
  }
  for (let y = horizon - 24; y < horizon - 19; y += 1) {
    for (let x = 124; x < 130; x += 1) if (hash(x, y) < 0.7) ctx.fillRect(x, y, 1, 1)
  }
  ctx.fillRect(131, horizon - 22, 1, 2)
  // steam
  const s = f % 16
  if (s < 10) ctx.fillRect(126 + (s % 4 < 2 ? 0 : 1), horizon - 26 - s, 1, 1)
  // critter with a gray tail, pottering near the desk
  const mx = wander(f, 62, 96, 0.35)
  const moving = Math.abs(wander(f + 1, 62, 96, 0.35) - mx) > 0.05
  drawWalker(ctx, f, blink, mx, horizon, moving)
  ctx.fillStyle = GRAY
  const flick = Math.floor(f / 6) % 2
  ctx.fillRect(Math.round(mx) - 5, horizon - 8, 8, 2) // tail meets the body
  ctx.fillRect(Math.round(mx) - 8, horizon - 11 - flick, 4, 2)
  ctx.fillRect(Math.round(mx) - 10, horizon - 14 - flick, 3, 2)
  // butterfly visiting the plants
  drawButterfly(ctx, f, wander(f, 150, 180, 0.9), 50 + Math.sin(f / 6) * 5)
}

function sceneGlobe(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
  const cx = 96
  const cy = 128
  const R = 66
  // rotating dot-continent globe
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
  // two orbiting satellites + a crescent moon
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
  // stars
  for (let i = 0; i < 26; i++) {
    if (hash(i, Math.floor(f / 5)) > 0.35) {
      ctx.fillRect(Math.round(hash(i, 3) * (W - 8)) + 4, Math.round(hash(i, 5) * 46) + 4, 1, 1)
    }
  }
  // critter with sunglasses on top of the world
  const sx = cx - 22
  const sy = cy - R - 26
  drawSprite(ctx, SPRITE.slice(0, 12), sx, sy, CELL, false)
  ctx.fillStyle = EYE
  ctx.fillRect(sx + 2 * CELL, sy + 4 * CELL, 8 * CELL, blink ? CELL : 2 * CELL)
  ctx.fillRect(sx + 12 * CELL, sy + 4 * CELL, 6 * CELL, blink ? CELL : 2 * CELL)
  ctx.fillRect(sx + 10 * CELL, sy + 4 * CELL, 2 * CELL, 1)
}

function sceneNight(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
  // dense twinkling starfield + a constellation
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
  // moon with craters
  drawCloud(ctx, 152, 22, 12, 11)
  ctx.fillStyle = '#1e1e1e'
  ctx.fillRect(148, 18, 3, 3)
  ctx.fillRect(156, 26, 2, 2)
  ctx.fillStyle = INK
  // shooting star every ~9s
  const t = f % 108
  if (t < 10) {
    for (let k = 0; k < 5; k++) ctx.fillRect(20 + t * 6 - k * 3, 14 + t * 2 - k, 1, 1)
  }
  const horizon = 92
  drawHills(ctx, horizon, 11)
  drawGround(ctx, horizon, 0.3)
  // fireflies drifting low
  for (let i = 0; i < 4; i++) {
    if (hash(i, Math.floor(f / 4)) > 0.4) {
      ctx.fillRect(
        Math.round(wander(f, 20, W - 20, 0.4 + i * 0.13, i * 37)),
        horizon - 16 + Math.round(Math.sin(f / 6 + i * 2) * 5),
        1, 1
      )
    }
  }
  // campfire: flicker + smoke
  const fx = 120
  ctx.fillStyle = BODY
  const lick = Math.floor(f / 2) % 3
  ctx.fillRect(fx, horizon - 6 - lick, 3, 4 + lick)
  ctx.fillRect(fx - 2, horizon - 3, 7, 3)
  ctx.fillStyle = INK
  ctx.fillRect(fx - 4, horizon - 1, 11, 1)
  const sm = f % 14
  if (sm < 10) ctx.fillRect(fx + 1 + (sm % 4 < 2 ? 1 : -1), horizon - 10 - sm, 1, 1)
  // critter and buddy sitting by the fire
  drawWalker(ctx, f, blink, 78, horizon, false)
  drawBuddy(ctx, f, blink, 140, horizon, 8)
}

function sceneRain(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
  // heavy clouds
  drawCloud(ctx, 40, 12, 30, 8)
  drawCloud(ctx, 110, 8, 34, 7)
  drawCloud(ctx, 168, 14, 22, 6)
  const horizon = 92
  // slanted rain streaks
  for (let i = 0; i < 46; i++) {
    const rx = (hash(i, 5) * W + f * 1.2) % W
    const ry = (hash(i, 9) * H + f * 5) % (horizon - 18) + 18
    ctx.fillRect(Math.round(rx), Math.round(ry), 1, 3)
    ctx.fillRect(Math.round(rx) + 1, Math.round(ry) - 2, 1, 2)
  }
  drawGround(ctx, horizon, 0.32)
  // puddle with ripple rings
  const px = 132
  for (let x = -16; x <= 16; x += 2) {
    if (hash(x + 50, 2) < 0.7) ctx.fillRect(px + x, horizon + 6, 1, 1)
  }
  const rip = (f % 18) / 18
  const rr = Math.round(rip * 12)
  for (let a = 0; a < Math.PI * 2; a += 0.5) {
    if (rip < 0.8) ctx.fillRect(Math.round(px + Math.cos(a) * rr), Math.round(horizon + 6 + Math.sin(a) * rr * 0.3), 1, 1)
  }
  // critter under an umbrella, buddy splashing in the puddle
  const mx = wander(f, 44, 84, 0.3)
  const moving = Math.abs(wander(f + 1, 44, 84, 0.3) - mx) > 0.05
  drawWalker(ctx, f, blink, mx, horizon, moving)
  // umbrella: dotted canopy + gray stem
  const ux = Math.round(mx) + 21
  for (let x = -16; x <= 16; x += 2) {
    const y = -Math.round(Math.sqrt(Math.max(0, 256 - x * x)) * 0.45)
    ctx.fillRect(ux + x, horizon - 40 + y, 1, 1)
    if (hash(x, 77) < 0.5) ctx.fillRect(ux + x, horizon - 39 + y, 1, 1)
  }
  ctx.fillStyle = GRAY
  ctx.fillRect(ux, horizon - 40, 1, 14)
  drawBuddy(ctx, f, blink, px - 8 + Math.sin(f / 5) * 3, horizon + 4, 3)
}

function sceneRooftop(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
  // stars + moon
  for (let i = 0; i < 30; i++) {
    if (hash(i, Math.floor(f / 6)) > 0.35) {
      ctx.fillRect(Math.round(hash(i, 11) * (W - 8)) + 4, Math.round(hash(i, 13) * 40) + 4, 1, 1)
    }
  }
  drawCloud(ctx, 30, 16, 9, 8)
  // skyline: dotted towers with twinkling windows
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
    // lit windows blink slowly
    for (let wy = ty + 4; wy < 84; wy += 6) {
      for (let wx = tx + 3; wx < tx + tw - 2; wx += 5) {
        if (hash(wx, wy + Math.floor(f / 30)) > 0.55) ctx.fillRect(wx, wy, 2, 2)
      }
    }
  }
  // foreground rooftop
  for (let x = 0; x < W; x += 1) ctx.fillRect(x, 88, 1, 1)
  for (let y = 90; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) if (hash(x, y) < 0.3) ctx.fillRect(x, y, 1, 1)
  }
  // antenna with a blinking clay beacon
  ctx.fillRect(160, 66, 1, 22)
  ctx.fillRect(156, 72, 9, 1)
  if (Math.floor(f / 6) % 2 === 0) {
    ctx.fillStyle = BODY
    ctx.fillRect(159, 63, 3, 3)
    ctx.fillStyle = INK
  }
  // critter and buddy sitting on the edge, looking at the city
  drawSprite(ctx, SPRITE.slice(0, 12), 66, 88 - 24 + (Math.floor(f / 8) % 2), CELL, blink)
  drawBuddy(ctx, f, blink, 104, 88 + 2, 8)
  // a bird crosses the skyline
  const t = f % 130
  if (t < 80) drawBird(ctx, W - t * 2.6, 30 + Math.sin(t / 6) * 4, Math.floor(t / 3) % 2 === 0)
}

const SCENES = [sceneMeadow, sceneSurf, sceneGarden, sceneDisco, sceneGlobe, sceneNight, sceneRain, sceneRooftop]
const DISCO = 3
const TRANS_FRAMES = 24 // ~2s: dissolve → linked orb → scatter into next scene

interface Particle {
  sx: number; sy: number // start (pixel of outgoing scene)
  tx: number; ty: number // target (pixel of incoming scene)
  a: number; r: number; tilt: number // orbit params
  color: string
}

// render a scene offscreen and sample up to n lit pixels (position + color)
function samplePixels(scene: (ctx: Ctx, f: number, b: boolean) => void, f: number, n: number): { x: number; y: number; color: string }[] {
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const octx = off.getContext('2d')!
  scene(octx, f, false)
  const img = octx.getImageData(0, 0, W, H).data
  const lit: { x: number; y: number; color: string }[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (img[i + 3] > 0) {
        lit.push({ x, y, color: `rgb(${img[i]},${img[i + 1]},${img[i + 2]})` })
      }
    }
  }
  const step = Math.max(1, Math.floor(lit.length / n))
  const out: { x: number; y: number; color: string }[] = []
  for (let i = 0; i < lit.length && out.length < n; i += step) out.push(lit[i])
  return out
}

function buildParticles(fromScene: number, toScene: number, fromF: number, toF: number): Particle[] {
  const src = samplePixels(SCENES[fromScene], fromF, 300)
  const dst = samplePixels(SCENES[toScene], toF, 300)
  const count = Math.min(src.length, dst.length)
  const parts: Particle[] = []
  for (let i = 0; i < count; i++) {
    const s = src[i]
    const d = dst[(i * 7) % count] // shuffle pairings so paths cross
    parts.push({
      sx: s.x, sy: s.y, tx: d.x, ty: d.y,
      a: hash(i, 1) * Math.PI * 2,
      r: 18 + hash(i, 2) * 14,
      tilt: 0.45 + hash(i, 3) * 0.25,
      color: s.color
    })
  }
  return parts
}

const ease = (t: number): number => 1 - Math.pow(1 - t, 3)

function drawTransition(ctx: Ctx, parts: Particle[], t: number): void {
  const cx = W / 2
  const cy = 52
  const spin = 2.6
  const pos = (p: Particle): { x: number; y: number } => {
    if (t < 0.35) {
      // gather: scene pixels spiral in toward their orbit slot
      const k = ease(t / 0.35)
      const ox = cx + Math.cos(p.a) * p.r
      const oy = cy + Math.sin(p.a) * p.r * p.tilt
      return { x: p.sx + (ox - p.sx) * k, y: p.sy + (oy - p.sy) * k }
    }
    if (t < 0.68) {
      // orbit: the orb spins as one body
      const k = (t - 0.35) / 0.33
      const a = p.a + k * spin
      return { x: cx + Math.cos(a) * p.r, y: cy + Math.sin(a) * p.r * p.tilt }
    }
    // scatter: fly out to the incoming scene's pixels
    const k = ease((t - 0.68) / 0.32)
    const a = p.a + spin
    const ox = cx + Math.cos(a) * p.r
    const oy = cy + Math.sin(a) * p.r * p.tilt
    return { x: ox + (p.tx - ox) * k, y: oy + (p.ty - oy) * k }
  }
  const pts: { x: number; y: number }[] = []
  for (const p of parts) {
    const q = pos(p)
    pts.push(q)
    ctx.fillStyle = p.color
    ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1)
  }
  // constellation links while the orb holds together
  if (t >= 0.28 && t < 0.75) {
    ctx.fillStyle = INK
    for (let i = 0; i < pts.length; i += 9) {
      const a = pts[i]
      const b = pts[(i + 4) % pts.length]
      const dx = b.x - a.x
      const dy = b.y - a.y
      if (dx * dx + dy * dy > 26 * 26) continue
      for (let s = 0.25; s < 1; s += 0.25) {
        ctx.fillRect(Math.round(a.x + dx * s), Math.round(a.y + dy * s), 1, 1)
      }
    }
  }
}

export function CoreScene({ usagePercent, busy }: { usagePercent: number; busy: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const usageRef = useRef(usagePercent)
  usageRef.current = usagePercent
  // mount the loop exactly once — prop changes must never reset the frame
  // counter or the scene rotation restarts from meadow on every usage tick
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let parts: Particle[] | null = null
    let partsSlot = -1
    let raf = 0
    let lastFrame = -1
    const start = performance.now()

    // scenes step at a chunky 12fps; the transition runs on continuous time
    // at full refresh rate so the orb glides instead of stuttering
    const loop = (now: number): void => {
      const tf = ((now - start) / 1000) * FPS // fractional frame clock
      const frame = Math.floor(tf)
      const slot = Math.floor(frame / SCENE_FRAMES)
      const sceneIdx = busyRef.current ? DISCO : slot % SCENES.length
      const inScene = tf - slot * SCENE_FRAMES
      if (inScene < TRANS_FRAMES && slot > 0 && !busyRef.current) {
        if (partsSlot !== slot) {
          const prev = (slot - 1) % SCENES.length
          parts = buildParticles(prev, sceneIdx, frame - 1, frame + TRANS_FRAMES)
          partsSlot = slot
        }
        ctx.clearRect(0, 0, W, H)
        drawTransition(ctx, parts!, inScene / TRANS_FRAMES)
        lastFrame = -1
      } else if (frame !== lastFrame) {
        parts = null
        const blinkEvery = usageRef.current > 80 ? 24 : 48
        ctx.clearRect(0, 0, W, H)
        SCENES[sceneIdx](ctx, frame, frame % blinkEvery >= blinkEvery - 6)
        lastFrame = frame
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
      <canvas
        ref={ref}
        width={W}
        height={H}
        style={{ width: '100%', maxWidth: 560, imageRendering: 'pixelated', aspectRatio: '16/9' }}
      />
    </div>
  )
}
