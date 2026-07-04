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

// --- scenes ------------------------------------------------------------

function sceneMeadow(ctx: Ctx, f: number, blink: boolean): void {
  const drift = (f * 0.35) % (W + 120)
  drawCloud(ctx, ((30 + drift) % (W + 120)) - 60, 20, 32, 10)
  drawCloud(ctx, ((140 + drift * 0.6) % (W + 120)) - 60, 36, 22, 7)
  const horizon = 90
  drawGround(ctx, horizon)
  // tufts of dot grass
  ctx.fillStyle = INK
  for (let i = 0; i < 8; i++) {
    const gx = Math.round(hash(i, 3) * (W - 10)) + 5
    ctx.fillRect(gx, horizon - 2, 1, 2)
    ctx.fillRect(gx + 2, horizon - 1, 1, 1)
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
  // big swell peaking right of center: steep face on the left, long back
  const surface = (x: number): number => {
    const sigma = x < 146 ? 34 : 70
    return 102 - 66 * Math.exp(-((x - 146) ** 2) / (2 * sigma * sigma))
  }
  for (let x = 0; x < W; x += 2) {
    const top = surface(x)
    // foam edge along the crest
    if (hash(x, 999) < 0.75) ctx.fillRect(x, Math.round(top), 1, 1)
    for (let y = Math.round(top) + 2; y < H; y += 2) {
      const depth = (y - top) / (H - top)
      if (hash(x, y) < 0.1 + depth * 0.42) ctx.fillRect(x, y, 1, 1)
    }
  }
  // dense water band at the bottom
  for (let y = 98; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) if (hash(x, y + 7) < 0.55) ctx.fillRect(x, y, 1, 1)
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
  const boardY = Math.round(surfY) + 1 + (Math.floor(f / 4) % 2)
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
  for (let i = 0; i < 16; i++) {
    if (hash(i, Math.floor(f / 3)) > 0.45) {
      ctx.fillRect(Math.round(hash(i, 7) * (W - 8)) + 4, Math.round(hash(i, 13) * 66) + 8, 1, 1)
    }
  }
  const floor = 94
  drawGround(ctx, floor, 0.28)
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
  const horizon = 92
  drawGround(ctx, horizon, 0.26)
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
  // orbiting satellite dot
  const oa = f / 18
  ctx.fillRect(Math.round(cx + Math.cos(oa) * 84), Math.round(62 + Math.sin(oa) * 20), 2, 2)
  // stars
  for (let i = 0; i < 14; i++) {
    if (hash(i, Math.floor(f / 5)) > 0.4) {
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
  // twinkling stars + dot moon
  for (let i = 0; i < 34; i++) {
    if (hash(i, Math.floor(f / 6) + Math.floor(i / 7)) > 0.35) {
      ctx.fillRect(Math.round(hash(i, 11) * (W - 8)) + 4, Math.round(hash(i, 17) * 62) + 4, 1, 1)
    }
  }
  drawCloud(ctx, 152, 22, 11, 10)
  // shooting star every ~9s
  const t = f % 108
  if (t < 10) {
    for (let k = 0; k < 5; k++) ctx.fillRect(20 + t * 6 - k * 3, 14 + t * 2 - k, 1, 1)
  }
  const horizon = 92
  drawGround(ctx, horizon, 0.3)
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

const SCENES = [sceneMeadow, sceneSurf, sceneGarden, sceneDisco, sceneGlobe, sceneNight]
const DISCO = 3

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
    let frame = 0

    const draw = (): void => {
      ctx.clearRect(0, 0, W, H)
      const blinkEvery = usageRef.current > 80 ? 24 : 48
      const slot = Math.floor(frame / SCENE_FRAMES)
      const sceneIdx = busyRef.current ? DISCO : slot % SCENES.length
      const inScene = frame % SCENE_FRAMES
      if (inScene < STATIC_FRAMES && !busyRef.current) {
        ctx.fillStyle = INK
        for (let i = 0; i < 420; i++) {
          ctx.fillRect(
            Math.round(hash(i, frame) * (W - 1)),
            Math.round(hash(i + 500, frame) * (H - 1)),
            1, 1
          )
        }
      } else {
        const blinking = frame % blinkEvery >= blinkEvery - 6
        SCENES[sceneIdx](ctx, frame, blinking)
      }
      frame++
    }
    draw()
    const timer = setInterval(draw, 1000 / FPS)
    return () => clearInterval(timer)
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
