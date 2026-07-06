import type { CustomScene } from '@shared/types'

// Compose a declarative scene: sky gradient, ground band, then each placed
// sprite (with optional ambient drift/bob). Pure drawing — no state. A prop
// whose sprite is missing from the map is skipped.
export function drawCustomScene(
  ctx: CanvasRenderingContext2D,
  scene: CustomScene,
  spritesByName: Map<string, string[][]>,
  f: number,
  W: number,
  H: number
): void {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, scene.sky[0])
  g.addColorStop(1, scene.sky[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const horizon = Math.round(H * 0.78)
  ctx.fillStyle = scene.ground
  ctx.fillRect(0, horizon, W, H - horizon)

  for (const p of scene.props) {
    const grid = spritesByName.get(p.sprite)
    if (!grid || grid.length === 0 || !grid[0]) continue
    const gw = grid[0].length
    const gh = grid.length
    const drift = p.drift ? Math.sin(f / 90) * 6 : 0
    const bob = p.drift ? Math.round(Math.sin(f / 30)) : 0
    const ox = Math.round((p.x / 100) * W + drift - (gw * p.scale) / 2)
    const oy = Math.round((p.y / 100) * H + bob - (gh * p.scale) / 2)
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const col = grid[y][x]
        if (col) {
          ctx.fillStyle = col
          ctx.fillRect(ox + x * p.scale, oy + y * p.scale, p.scale, p.scale)
        }
      }
    }
  }
}
