// IND-34m: cold, desaturated, grey-blue. Warm light is the EXCEPTION and it always
// means something. One palette, written down, never deviated from (game-art).

export const P = {
  // the world: cold, dry, dead
  void:      '#05070a',
  ground0:   '#0d1218',
  ground1:   '#131a22',
  ground2:   '#1a232d',
  structure: '#232e3a',
  edge:      '#2f3d4c',
  dust:      '#3a4757',

  // the living: warm, and rare
  player:    '#e8e2d6',
  playerHi:  '#ffffff',

  // machines: colder than the ground, so they read as objects and not as terrain
  machine:   '#4a5a6e',
  machineHi: '#6b7f97',
  stopped:   '#2b3642',   // the ones that gave up. on, but doing nothing (IND-34l)

  // the only saturated colour in the game, used ONLY for harm
  harm:      '#c9414f',
  harmDim:   '#7a2530',

  // warm light: the exception, always meaningful
  lamp:      '#f0c98a',
  glow:      '#ffd9a0',   // a fragment that has not fully stopped (IND-34i)
  salvage:   '#c9a84c',

  // the companion has its own colour so it is never confused with anything else
  comp:      '#8fb8ff',
  compDim:   '#3f5a80',
} as const

export type Colour = typeof P[keyof typeof P]

/** hex to rgba() at a given alpha. */
export function hex(c: string, a: number): string {
  const n = parseInt(c.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** mix two palette colours. used for damage flash and for distance fade. */
export function mix(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16)
  const r = Math.round(((x >> 16) & 255) * (1 - t) + ((y >> 16) & 255) * t)
  const g = Math.round(((x >> 8) & 255) * (1 - t) + ((y >> 8) & 255) * t)
  const bl = Math.round((x & 255) * (1 - t) + (y & 255) * t)
  return `rgb(${r},${g},${bl})`
}
