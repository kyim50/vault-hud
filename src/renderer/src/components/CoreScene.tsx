import { useEffect, useRef } from 'react'

// Halftone scene engine: four rotating Claude FM-style scenes with the clay
// critter and friends. Ink dots on the terminal ground; clay is the only color.
const W = 192
const H = 108
const INK = '#e8e6e3'
const BODY = '#d97757'
const DARK = '#b85c3f'
const BODY_LIGHT = '#e8a284'
const EYE = '#17160f'
const GRAY = '#9a9a9a'

const FPS = 12
const SCENE_FRAMES = 25 * FPS // 25s per scene
const STATIC_FRAMES = 5 // channel-flip burst between scenes

// 22x14 critter: B body, D shaded edge, E eye, n top nub, L leg, . empty
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

// 8x5 buddy critter
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

type Ctx = CanvasRenderingContext2D

function drawSprite(ctx: Ctx, rows: string[], sx: number, sy: number, cell: number, blinking: boolean, tuck?: 0 | 1): void {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c]
      if (ch === '.') continue
      if (tuck !== undefined && ch === 'L' && r === rows.length - 1) {
        if (tuck === 1 && c < rows[r].length / 2) continue
        if (tuck === 0 && c >= rows[r].length / 2) continue
      }
      ctx.fillStyle =
        ch === 'E' ? (blinking ? BODY : EYE) : ch === 'D' || ch === 'n' ? DARK : BODY
      ctx.fillRect(sx + c * cell, sy + r * cell, cell, cell)
    }
  }
}

function drawHeadphones(ctx: Ctx, sx: number, sy: number, cell: number): void {
  ctx.fillStyle = INK
  const w = SPRITE[0].length
  // band across the top
  for (let c = 3; c < w - 3; c++) ctx.fillRect(sx + c * cell, sy - cell, cell, cell)
  // ear cups
  for (let r = 2; r < 6; r++) {
    ctx.fillRect(sx - cell, sy + r * cell, cell * 2, cell)
    ctx.fillRect(sx + (w - 1) * cell, sy + r * cell, cell * 2, cell)
  }
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

function drawGround(ctx: Ctx, horizon: number, maxDensity = 0.43): void {
  ctx.fillStyle = INK
  for (let y = horizon; y < H; y += 2) {
    const t = (y - horizon) / (H - horizon)
    const density = 0.08 + t * (maxDensity - 0.08)
    for (let x = 0; x < W; x += 2) {
      if (hash(x, y) < density) ctx.fillRect(x, y, 1, 1)
    }
  }
}

function drawBird(ctx: Ctx, x: number, y: number, flap: boolean): void {
  ctx.fillStyle = INK
  const px = Math.round(x)
  if (flap) {
    ctx.fillRect(px - 3, y - 2, 2, 1)
    ctx.fillRect(px + 2, y - 2, 2, 1)
    ctx.fillRect(px - 1, y - 1, 3, 1)
  } else {
    ctx.fillRect(px - 4, y, 3, 1)
    ctx.fillRect(px + 2, y, 3, 1)
    ctx.fillRect(px - 1, y - 1, 3, 1)
  }
}

// --- scenes ------------------------------------------------------------

function sceneMeadow(ctx: Ctx, f: number, blink: boolean): void {
  const drift = (f * 0.4) % (W + 120)
  drawCloud(ctx, ((36 + drift) % (W + 120)) - 60, 22, 34, 11)
  drawCloud(ctx, ((150 + drift * 0.6) % (W + 120)) - 60, 38, 24, 8)
  const horizon = 88
  drawGround(ctx, horizon)
  const bob = Math.floor(f / 6) % 2
  drawSprite(ctx, SPRITE, Math.round(W / 2 - 33), horizon - 42 + 2 + bob, 3, blink, bob as 0 | 1)
  // buddy hops on the right
  const hop = Math.floor(f / 4) % 4 === 0 ? -2 : 0
  drawSprite(ctx, BUDDY, 150, horizon - 10 + hop, 2, blink)
  // a bird crosses every ~10s
  const t = f % 120
  if (t < 70) drawBird(ctx, -6 + t * 3, 26 + Math.sin(t / 4) * 3, Math.floor(t / 3) % 2 === 0)
}

function sceneSurf(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
  // wave surface: low at left, crest toward the right, curl at the top
  const surface = (x: number): number => {
    const s = Math.min(1, Math.max(0, (x - 6) / 150))
    return 98 - Math.pow(s, 1.7) * 52
  }
  for (let x = 0; x < W; x += 2) {
    const top = surface(x)
    for (let y = Math.round(top); y < H; y += 2) {
      const depth = (y - top) / (H - top)
      if (hash(x, y) < 0.1 + depth * 0.4) ctx.fillRect(x, y, 1, 1)
    }
  }
  // curl: dotted arc hooking back over the crest
  const cx = 168
  const cy = 52
  for (let a = -0.2; a < Math.PI * 0.9; a += 0.09) {
    const r = 13 - a * 2.5
    const x = Math.round(cx - Math.cos(a) * r)
    const y = Math.round(cy - Math.sin(a) * r)
    if (hash(x, y + f % 3) < 0.8) ctx.fillRect(x, y, 1, 1)
  }
  // spray flecks near the curl
  for (let i = 0; i < 8; i++) {
    const sx = 150 + Math.round(hash(i, Math.floor(f / 2)) * 34)
    const sy = 28 + Math.round(hash(i + 40, Math.floor(f / 2)) * 22)
    ctx.fillRect(sx, sy, 1, 1)
  }
  // rider: board + critter gliding along the face
  const mx = 78 + Math.sin(f / 14) * 10
  const my = surface(mx + 22) - 44 + Math.sin(f / 7) * 2
  ctx.fillStyle = BODY_LIGHT
  ctx.fillRect(Math.round(mx - 6), Math.round(my + 42), 76, 4)
  drawSprite(ctx, SPRITE.slice(0, 12), Math.round(mx), Math.round(my), 3, blink)
}

function sceneDisco(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
  // hanging line + mirror ball with rotating facets
  const bx = 96
  const by = 28
  const R = 15
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
  // sparkles
  for (let i = 0; i < 14; i++) {
    if (hash(i, Math.floor(f / 4)) > 0.5) {
      const sx = Math.round(hash(i, 7) * (W - 8)) + 4
      const sy = Math.round(hash(i, 13) * 70) + 8
      ctx.fillRect(sx, sy, 1, 1)
    }
  }
  const floor = 92
  drawGround(ctx, floor, 0.3)
  // DJ critter with headphones behind the decks
  const bob = Math.floor(f / 3) % 2
  const sx = Math.round(W / 2 - 33)
  const sy = floor - 42 - 4 + bob
  drawSprite(ctx, SPRITE, sx, sy, 3, blink, bob as 0 | 1)
  drawHeadphones(ctx, sx, sy, 3)
  // deck table: dotted edge + two ink turntables
  ctx.fillStyle = INK
  for (let x = 52; x < 140; x += 2) ctx.fillRect(x, floor - 12, 1, 1)
  ctx.fillStyle = EYE
  ctx.fillRect(60, floor - 10, 14, 4)
  ctx.fillRect(118, floor - 10, 14, 4)
  ctx.fillStyle = INK
  ctx.fillRect(66 + (f % 4 < 2 ? 1 : -1), floor - 9, 2, 2)
  ctx.fillRect(124 + (f % 4 < 2 ? -1 : 1), floor - 9, 2, 2)
  // buddy dancing on the left
  const hop = f % 6 < 3 ? -3 : 0
  drawSprite(ctx, BUDDY, 26, floor - 10 + hop, 2, blink)
}

function sceneGarden(ctx: Ctx, f: number, blink: boolean): void {
  ctx.fillStyle = INK
  // window frame with a dot sun inside
  for (let x = 62; x <= 148; x += 2) {
    ctx.fillRect(x, 12, 1, 1)
    ctx.fillRect(x, 58, 1, 1)
  }
  for (let y = 12; y <= 58; y += 2) {
    ctx.fillRect(62, y, 1, 1)
    ctx.fillRect(148, y, 1, 1)
  }
  drawCloud(ctx, 122, 30, 10, 7) // soft dot sun
  // plant fronds, left and right
  for (const px of [22, 172]) {
    for (let i = 0; i < 60; i++) {
      const a = hash(i, px) * Math.PI - Math.PI / 2
      const r = hash(i + 9, px) * 26
      const x = Math.round(px + Math.sin(a) * r * 0.6)
      const y = Math.round(78 - Math.abs(Math.cos(a)) * r)
      if (hash(x, y) < 0.8) ctx.fillRect(x, y, 1, 1)
    }
    for (let y = 80; y < 92; y += 2) {
      for (let x = px - 8; x <= px + 8; x += 2) {
        if (hash(x, y) < 0.55) ctx.fillRect(x, y, 1, 1)
      }
    }
  }
  const horizon = 90
  drawGround(ctx, horizon, 0.3)
  // critter watering a sprout
  const bob = Math.floor(f / 8) % 2
  const sx = 66
  const sy = horizon - 42 + bob
  drawSprite(ctx, SPRITE, sx, sy, 3, blink, bob as 0 | 1)
  ctx.fillStyle = GRAY
  ctx.fillRect(sx + 66, sy + 24, 10, 4) // watering can spout
  ctx.fillRect(sx + 74, sy + 22, 3, 3)
  // falling drops + growing sprout
  ctx.fillStyle = INK
  const drop = (f % 8) * 2
  if (drop < 14) ctx.fillRect(sx + 80, sy + 28 + drop, 1, 2)
  const growth = Math.min(10, Math.floor((f % SCENE_FRAMES) / 24))
  for (let g = 0; g < growth; g++) ctx.fillRect(sx + 80, horizon - 2 - g, 1, 1)
  if (growth > 4) {
    ctx.fillRect(sx + 78, horizon - growth, 2, 1)
    ctx.fillRect(sx + 81, horizon - growth + 2, 2, 1)
  }
}

const SCENES = [sceneMeadow, sceneSurf, sceneDisco, sceneGarden]
const DISCO = 2

export function CoreScene({ usagePercent, busy }: { usagePercent: number; busy: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let frame = 0
    const blinkEvery = usagePercent > 80 ? 24 : 48

    const draw = (): void => {
      ctx.clearRect(0, 0, W, H)
      const slot = Math.floor(frame / SCENE_FRAMES)
      const sceneIdx = busyRef.current ? DISCO : slot % SCENES.length
      const inScene = frame % SCENE_FRAMES
      if (inScene < STATIC_FRAMES && !busyRef.current) {
        // channel-flip: a burst of static between scenes
        ctx.fillStyle = INK
        for (let i = 0; i < 420; i++) {
          const x = Math.round(hash(i, frame) * (W - 1))
          const y = Math.round(hash(i + 500, frame) * (H - 1))
          ctx.fillRect(x, y, 1, 1)
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
  }, [usagePercent])
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
