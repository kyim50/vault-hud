export type RGB = [number, number, number]

export function parseHex(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function toHex(rgb: RGB): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

// t clamped to [0,1]; t=0 → a, t=1 → b
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const ca = parseHex(a)
  const cb = parseHex(b)
  return toHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * k) as unknown as RGB)
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, '#ffffff', amount)
}

export function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount)
}
