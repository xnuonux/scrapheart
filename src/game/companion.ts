// The companion. IND-34a, IND-34c.
//
// You never command it. It scores every behaviour it can hold WARM (limited by RAM),
// and acts on the highest. Everything it is comes from installed fragments.
//
// The prototype (blueprints/independent/prototypes) measured that mutual perception
// produces task division and that RAM visibly drops behaviours under load. Both are
// carried forward here.

import { Fragment, effective } from './fragments'
import type { World } from './world'

export type Behaviour = 'engage' | 'cover' | 'repair' | 'salvage' | 'follow' | 'investigate' | 'flee'
export const BEHAVIOURS: Behaviour[] = ['engage', 'cover', 'repair', 'salvage', 'follow', 'investigate', 'flee']

export interface Body {
  /** how many fragments run at once. IND-34c: installed is not active. */
  ram: number
  /** decision rate: how often the scorer re-evaluates */
  cpu: number
  /** perception radius */
  gpu: number
  /** sustain before it must conserve */
  battery: number
  sockets: number
  auxSockets: number
}

export const STARTER_BODY: Body = { ram: 2, cpu: 0.7, gpu: 170, battery: 1, sockets: 3, auxSockets: 0 }

export class Companion {
  x = 0; y = 0; prevX = 0; prevY = 0
  r = 7
  hp = 50; maxHp = 50
  name = ''
  named = false

  body: Body = { ...STARTER_BODY }
  installed: (Fragment | null)[] = [null, null, null]

  behaviour: Behaviour = 'follow'
  scores: Record<string, number> = {}
  warm = new Set<Behaviour>()
  /** decide() lives outside the class, so this cannot be private */
  think = 0
  exposure = 0
  repairCd = 0
  charge = 1        // battery drain under sustained activity
  poi: { x: number; y: number } | null = null

  /** IND-34a: history. did you repair it when it was hurt, or only when convenient. */
  careShown = 0

  // ── derived from fragments, recomputed on install/remove ──
  loyalty = 0; caution = 0; aggression = 0; curiosity = 0
  can = { repair: false, salvage: false, mark: false, interpose: false }

  recompute() {
    this.loyalty = 0.15; this.caution = 0.15; this.aggression = 0.15; this.curiosity = 0.15
    this.can = { repair: false, salvage: false, mark: false, interpose: false }
    for (const f of this.installed) {
      if (!f) continue
      this.loyalty    += effective(f, f.loyalty)
      this.caution    += effective(f, f.caution)
      this.aggression += effective(f, f.aggression)
      this.curiosity  += effective(f, f.curiosity)
      for (const g of f.grants ?? []) this.can[g] = true
    }
    const clamp01 = (v: number) => Math.max(0, Math.min(1.2, v))
    this.loyalty = clamp01(this.loyalty); this.caution = clamp01(this.caution)
    this.aggression = clamp01(this.aggression); this.curiosity = clamp01(this.curiosity)
  }

  get liveFragments() { return this.installed.filter(Boolean) as Fragment[] }
  get emptySockets() { return this.installed.filter(f => f === null).length }

  install(f: Fragment, slot: number) {
    if (slot < 0 || slot >= this.installed.length) return false
    if (this.installed[slot]) return false
    this.installed[slot] = f
    this.recompute()
    return true
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const dist = (a: {x:number,y:number}, b: {x:number,y:number}) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * The scorer. Every behaviour is scored from world state and disposition.
 * P0 has one companion, so there is no `other` term yet ... but the prototype proved
 * mutual perception is what produces division of labour, so the signature keeps the
 * slot open for P2.
 */
export function score(c: Companion, w: World): Record<Behaviour, number> {
  const p = w.player
  const dP = dist(c, p)
  const near = w.threats.filter(t => t.alive && dist(c, t) < c.body.gpu)
                        .sort((a, b) => dist(c, a) - dist(c, b))
  const nearest = near[0]
  const dT = nearest ? dist(c, nearest) : 99999
  const playerHurt = 1 - p.hp / p.maxHp
  const selfHurt = 1 - c.hp / c.maxHp
  const lootNear = w.salvage.filter(s => dist(c, s) < c.body.gpu)
                            .sort((a, b) => dist(c, a) - dist(c, b))[0]
  const interesting = w.interest.find(i => !i.seen && dist(c, i) < c.body.gpu)

  const low = c.charge < 0.25 ? 1 : 0   // battery: it fights well and then stops

  const s = {} as Record<Behaviour, number>

  s.engage = c.aggression * 1.15 * (nearest ? clamp(1 - dT / c.body.gpu, 0, 1) : 0)
           - c.caution * 0.55 * selfHurt
           - low * 0.7

  // IND-34c: when you retreat, a brave companion advances. No special case needed:
  // the scorer already sees the player's movement.
  s.cover = c.loyalty * 1.30 * (p.retreating ? 1 : 0) * (nearest ? clamp(1 - dT / 260, 0, 1) : 0)
          - c.caution * 0.85
          - low * 0.5

  s.repair = c.can.repair
    ? playerHurt * 1.55 * (c.loyalty * 0.9 + 0.1)
      - c.caution * 0.35 * (nearest ? clamp(1 - dT / 200, 0, 1) : 0)
      - (c.repairCd > 0 ? 3 : 0)
    : 0

  s.salvage = c.can.salvage && lootNear
    ? 0.55 * (c.curiosity * 0.8 + 0.3) - c.caution * 0.5 * (nearest ? clamp(1 - dT / 190, 0, 1) : 0)
    : 0

  // IND-34i: curiosity is what finds what is buried, and IND-34m: it is what stops
  // at a thing worth nothing.
  s.investigate = interesting
    ? c.curiosity * 0.95 * (w.threats.some(t => t.alive && dist(c, t) < 240) ? 0.12 : 1)
    : c.curiosity * 0.25 * (near.length === 0 ? 1 : 0)

  s.flee = c.caution * 1.3 * selfHurt
         + (nearest && dT < 62 ? c.caution * 0.65 : 0)
         + low * 0.6
         - c.loyalty * 0.55 * (playerHurt > 0.5 ? 1 : 0)   // loyalty overrides self-preservation

  s.follow = 0.32 + clamp((dP - 130) / 240, 0, 1) * 0.8

  // jitter: never robotic. game-ai.
  for (const k of BEHAVIOURS) s[k] = Math.max(0, s[k] + (Math.random() - 0.5) * 0.07)
  return s
}

export function decide(c: Companion, w: World, dt: number) {
  c.think -= dt
  if (c.think > 0) return
  c.think = 0.10 / Math.max(0.25, c.body.cpu)

  const raw = score(c, w)
  const ranked = (Object.entries(raw) as [Behaviour, number][]).sort((a, b) => b[1] - a[1])

  // RAM: only the top `ram` behaviours stay warm. The rest are DROPPED and cannot be
  // chosen at all, however much the situation needs them. The prototype showed this is
  // the most legible thing in the whole system.
  const warm = new Set(ranked.slice(0, c.body.ram).map(e => e[0]))
  const wasWarmRepair = c.warm.has('repair')

  c.scores = raw; c.warm = warm
  const pick = ranked.find(e => warm.has(e[0]))
  const prev = c.behaviour
  c.behaviour = pick ? pick[0] : 'follow'

  if (wasWarmRepair && !warm.has('repair') && w.player.hp < w.player.maxHp * 0.7)
    w.log(`${c.name || 'it'} is too busy to help you.`)
  if (prev !== 'cover' && c.behaviour === 'cover') w.log(`${c.name || 'it'} moved in front of you.`)
  if (prev !== 'flee' && c.behaviour === 'flee') w.log(`${c.name || 'it'} broke off.`)
}
