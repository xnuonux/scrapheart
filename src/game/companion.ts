// The companion. IND-34a, IND-34c.
//
// You never command it. It scores every behaviour it can hold WARM (limited by RAM),
// and acts on the highest. Everything it is comes from installed fragments.
//
// The prototype (blueprints/independent/prototypes) measured that mutual perception
// produces task division and that RAM visibly drops behaviours under load. Both are
// carried forward here.

import { Fragment, effective } from './fragments'
import { isHostile, type World } from './world'

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
  /** the reload window. a warm slot cannot be swapped again until this drains. */
  swapCd = 0
  exposure = 0
  repairCd = 0
  charge = 1        // battery drain under sustained activity
  poi: { x: number; y: number } | null = null

  /** IND-34a: history. did you repair it when it was hurt, or only when convenient. */
  careShown = 0
  /** so the "it is hurt" line stays rare enough to be worth reading */
  hurtAnnounced = false

  /**
   * IND-34c §what death means. The fragments survive you. The relationship does not,
   * entirely.
   *
   * 1 is a machine that knows you. A companion retrieved by a NEW character starts
   * low: everything you built into it is intact, and it follows cautiously, because
   * you are not the same person. ⚠ This is the whole resolution of permadeath plus a
   * forty-hour companion, and it must never be free and never be total.
   */
  bond = 1

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
    // IND-34c: a companion that outlived its person keeps everything it is MADE of and
    // very little of what it FELT. ⚠ The fragments are untouched ... only the reading
    // of them is damped, and only loyalty, because loyalty is the part that was about
    // you specifically. It gets cautious instead, which is what a machine that watched
    // somebody die should be.
    this.loyalty *= 0.35 + 0.65 * this.bond
    this.caution += (1 - this.bond) * 0.40

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
 * What the companion can see, in ONE place.
 *
 * 🚨 This existed twice ... once in score() and once in act() ... and the copies drifted
 * the moment one was changed. The scorer learned that IND-34k's heart is visible from
 * further away (see `pull` below), the actor did not, and the result was a companion
 * that chose `investigate`, walked to a random point, and never reached the object it
 * had decided to go to. Measured: 48 of 90 samples in `investigate`, closest approach
 * 333px. It read as the feature working right up until you checked the distance.
 *
 * ⚠ Deciding and acting must perceive identically. If you add a sense, add it here.
 */
function perceive(c: Companion, w: World) {
  // IND-34i: dust attacks GPU. ⚠ Applied HERE, in the one perception, so a half-blind
  // companion decides and acts on the same half-blind world. A high-GPU build is
  // suddenly your eyes and a low one is a liability you love.
  const gpu = c.body.gpu * (1 - 0.62 * w.dustAt(c))
  // ⚠ isHostile, not `.alive`. A machine that gave up is in the same array and is not a
  // threat, and counting it made the companion afraid of furniture.
  const near = w.threats.filter(t => isHostile(t) && dist(c, t) < gpu)
                        .sort((a, b) => dist(c, a) - dist(c, b))
  return {
    gpu,
    near,
    nearest: near[0],
    dT: near[0] ? dist(c, near[0]) : 99999,
    lootNear: w.salvage.filter(s => dist(c, s) < gpu)
                       .sort((a, b) => dist(c, a) - dist(c, b))[0],
    // pull also extends REACH. A thing that insists harder is noticed from further
    // away, which is the same statement as "it pulls harder" and needs no second
    // mechanism. Without it the heart moment was a coin flip: two identical runs
    // measured 21px (pass) and 161px (fail) with no code change in between.
    interesting: w.interest.find(i => !i.seen && dist(c, i) < gpu * (i.pull ?? 1)),
  }
}

/**
 * The scorer. Every behaviour is scored from world state and disposition.
 * P0 has one companion, so there is no `other` term yet ... but the prototype proved
 * mutual perception is what produces division of labour, so the signature keeps the
 * slot open for P2.
 */
export function score(c: Companion, w: World): Record<Behaviour, number> {
  const p = w.player
  const dP = dist(c, p)
  const { near, nearest, dT, lootNear, interesting, gpu } = perceive(c, w)
  const playerHurt = 1 - p.hp / p.maxHp
  const selfHurt = 1 - c.hp / c.maxHp

  const low = c.charge < 0.25 ? 1 : 0   // battery: it fights well and then stops

  const s = {} as Record<Behaviour, number>

  // ⚠ `gpu`, not `c.body.gpu`. These normalise against perception range, and using the
  // raw stat here while perceive() uses the dust-reduced one would mean a companion that
  // cannot SEE a threat still scores it as close. Same two-sources-of-truth shape that
  // has now bitten this file twice.
  s.engage = c.aggression * 1.15 * (nearest ? clamp(1 - dT / gpu, 0, 1) : 0)
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
  //
  // ⚠ Measured 2026-08-06, 241 samples with the field cleared and an interest point
  // touching the companion: investigate peaked at 0.175 against a follow FLOOR of
  // 0.285, so it was never once chosen. The entire atmosphere system was unreachable
  // at starter curiosity ... which is the only curiosity a new player has.
  //
  // The fix is proximity. A curious machine is not equally drawn to everything in
  // its perception radius; it is drawn to what is right there. That gives the early
  // companion a reachable moment without handing a fragmentless machine a
  // disposition it did not earn.
  const dI = interesting ? dist(c, interesting) : 99999
  // pull: how hard the thing itself insists. 1 for scenery. IND-34k's heart is 5, and
  // it is the only thing above 1 in the whole game, so a frightened machine will still
  // cross a field for it. ⚠ Fear damps curiosity but must not be able to erase it,
  // or the one moment the design actually needs never fires.
  const pull = interesting?.pull ?? 1
  // 🚨 The worst instance of the furniture bug: standing near a machine that gave up
  // damped investigate to 12%, so the objects that ARE the atmosphere were switching
  // the atmosphere system off.
  const afraid = w.threats.some(t => isHostile(t) && dist(c, t) < 240)
  s.investigate = interesting
    ? c.curiosity * 2.1 * pull * clamp(1 - dI / (gpu * pull), 0, 1)
                        * (afraid ? Math.min(1, 0.12 * pull) : 1)
    : c.curiosity * 0.25 * (near.length === 0 ? 1 : 0)

  s.flee = c.caution * 1.3 * selfHurt
         + (nearest && dT < 62 ? c.caution * 0.65 : 0)
         + low * 0.6
         - c.loyalty * 0.55 * (playerHurt > 0.5 ? 1 : 0)   // loyalty overrides self-preservation

  // follow had a hard floor of 0.32 that nothing early could clear. A machine standing
  // at your shoulder does not need to want to follow you ... it is already there.
  s.follow = 0.10 + clamp((dP - 90) / 240, 0, 1) * 1.0

  // jitter: never robotic. game-ai.
  for (const k of BEHAVIOURS) s[k] = Math.max(0, s[k] + (Math.random() - 0.5) * 0.07)
  return s
}

export { perceive }

export function decide(c: Companion, w: World, dt: number) {
  c.think -= dt
  if (c.think > 0) return
  c.think = 0.10 / Math.max(0.25, c.body.cpu)

  const raw = score(c, w)
  const ranked = (Object.entries(raw) as [Behaviour, number][]).sort((a, b) => b[1] - a[1])

  // RAM: only what is WARM can be chosen. The rest are dropped and cannot be acted on,
  // however much the situation needs them.
  //
  // ⚠ Measured 2026-08-06: the pick matched the top scorer in 241 of 241 samples. The
  // warm set was recomputed each tick as the top-`ram` slice of the SAME ranking it was
  // meant to constrain, so ranked[0] was warm by construction and RAM gated nothing.
  // The signature mechanic of the whole game was an ornament.
  //
  // The warm set is what the machine is currently holding in mind, so it PERSISTS, and
  // loading something new takes time. That is what makes a low-RAM companion visibly
  // slow to react and a RAM upgrade something you feel rather than read.
  const wasWarmRepair = c.warm.has('repair')
  if (c.warm.size === 0) for (const e of ranked.slice(0, c.body.ram)) c.warm.add(e[0])

  c.swapCd = Math.max(0, c.swapCd - 0.10 / Math.max(0.25, c.body.cpu))
  while (c.warm.size > c.body.ram) {
    // RAM shrank (a fragment came out). Shed the coldest immediately.
    const worst = [...c.warm].sort((a, b) => raw[a] - raw[b])[0]
    c.warm.delete(worst)
  }
  if (c.swapCd <= 0) {
    const wants = ranked.slice(0, c.body.ram).map(e => e[0])
    const newcomer = wants.find(b => !c.warm.has(b))
    if (newcomer) {
      if (c.warm.size >= c.body.ram) {
        const worst = [...c.warm].sort((a, b) => raw[a] - raw[b])[0]
        c.warm.delete(worst)
      }
      c.warm.add(newcomer)
      c.swapCd = 1                              // one swap per reload window
    }
  }

  const warm = c.warm
  c.scores = raw
  const pick = ranked.find(e => warm.has(e[0]))
  const prev = c.behaviour
  c.behaviour = pick ? pick[0] : 'follow'

  // one place, so eviction and RAM shrinking cannot both announce the same drop.
  if (wasWarmRepair && !warm.has('repair') && w.player.hp < w.player.maxHp * 0.7)
    w.log(`${c.name || 'it'} is too busy to help you.`)
  if (prev !== 'cover' && c.behaviour === 'cover') w.log(`${c.name || 'it'} moved in front of you.`)
  if (prev !== 'flee' && c.behaviour === 'flee') w.log(`${c.name || 'it'} broke off.`)
}
