// THE HALT. IND-34b: a transit interchange where several thousand machines stopped
// mid-journey and never resumed. Densely packed, mostly harmless. The density is the
// tutorial ... a new player learns what a wreck looks like by standing in ten thousand.

import { Companion, decide, STARTER_BODY } from './companion'
import { Fragment, makeFragment } from './fragments'
import { sfx } from '../audio/sfx'
import { hitstop } from '../core/loop'
import { rng } from '../core/rng'

export interface Player {
  x: number; y: number; prevX: number; prevY: number
  hp: number; maxHp: number; r: number
  retreating: boolean
  lastHurt: number
  heat: number; overheated: number   // IND-34j: heat, not ammo
  fireCd: number
}

export interface Threat {
  x: number; y: number; r: number
  hp: number; maxHp: number
  speed: number
  wind: number            // the telegraph. built to be safe around humans.
  striking: boolean
  alive: boolean
  kind: 'runner' | 'stopped'
  seed: number
}

export interface Bullet { x: number; y: number; vx: number; vy: number; life: number; from: 'player' | 'comp' }
export interface Salvage { x: number; y: number; frag: string | null }
/** IND-34m: things worth finding that are worth nothing. no pickup, no counter. */
export interface Interest { x: number; y: number; seen: boolean; kind: 'view' | 'arrangement' | 'lamp' }

export const W = 1600, H = 1200

const dist = (a: {x:number,y:number}, b: {x:number,y:number}) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const clampW = (v: number) => clamp(v, 40, W - 40)
const clampH = (v: number) => clamp(v, 40, H - 40)

export class World {
  player: Player = {
    x: W / 2, y: H / 2, prevX: W / 2, prevY: H / 2,
    hp: 100, maxHp: 100, r: 8, retreating: false, lastHurt: -99,
    heat: 0, overheated: 0, fireCd: 0,
  }
  companion: Companion | null = null
  threats: Threat[] = []
  bullets: Bullet[] = []
  salvage: Salvage[] = []
  interest: Interest[] = []
  wrecks: { x: number; y: number; s: number; seed: number }[] = []
  /** what you are carrying. AT RISK. death takes all of it. */
  pack: Fragment[] = []
  /** what you carried home. SAFE. the only thing the recall buys you. */
  banked: Fragment[] = []
  chassis: { x: number; y: number; taken: boolean } | null = null

  t = 0
  logs: { text: string; t: number }[] = []
  spawnTimer = 3

  /** IND-34c: the anchor the recall returns you to. */
  anchor = { x: W / 2, y: H / 2 }
  /** rises to 1 on recall, decays. purely visual. */
  recallFlash = 0
  recallCount = 0
  /** salvage left behind by recalls. the receipt for what greed did not get. */
  abandoned = 0

  log(text: string) {
    this.logs.unshift({ text, t: this.t })
    if (this.logs.length > 6) this.logs.pop()
  }

  constructor() { this.generate() }

  generate() {
    const r = rng('the-halt')
    // ten thousand stopped machines, at P0 rendered as a field of wrecks
    for (let i = 0; i < 340; i++) {
      this.wrecks.push({ x: r() * W, y: r() * H, s: 6 + r() * 14, seed: r() * 1000 })
    }
    // THE OPENING, tuned against IND-34h's beat sheet: salvage by 0:03, the chassis
    // by 0:10, the machine standing by 0:14.
    //
    // ⚠ Playtest 2026-08-06 found this was pure luck: the chassis sat 320px away in a
    // 1600x1200 field with no marker, and a player who walked for thirty seconds found
    // neither it nor a single piece of salvage. Findability is not polish at P0, it is
    // whether the game has an opening at all.

    // the chassis, in an opened maintenance bay somebody had not finished.
    // close enough to be VISIBLE from spawn. it is the tutorial.
    this.chassis = { x: W / 2 + 150, y: H / 2 - 95, taken: false }

    // a trail of salvage between the player and it. nobody is told to follow it.
    const trail = 7
    for (let i = 0; i < trail; i++) {
      const t = (i + 1) / (trail + 1)
      this.salvage.push({
        x: W / 2 + 150 * t + (r() - 0.5) * 54,
        y: H / 2 - 95 * t + (r() - 0.5) * 54,
        frag: i === trail - 1 ? 'attend' : null,   // the first fragment sits ON the chassis
      })
    }
    // and the rest of the zone, scattered but reachable
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = 210 + r() * 430
      this.salvage.push({
        x: clampW(W / 2 + Math.cos(a) * d), y: clampH(H / 2 + Math.sin(a) * d),
        frag: i < 5 ? ['repair', 'prudence', 'pursuit', 'inquiry', 'ward'][i] : null,
      })
    }

    // things worth nothing. one is placed close, so a player learns the category
    // exists before they have wandered far enough to miss it entirely.
    this.interest.push({ x: W / 2 - 190, y: H / 2 + 130, seen: false, kind: 'lamp' })
    for (let i = 0; i < 8; i++) {
      this.interest.push({
        x: 110 + r() * (W - 220), y: 110 + r() * (H - 220), seen: false,
        kind: (['view', 'arrangement', 'lamp'] as const)[Math.floor(r() * 3)],
      })
    }
    for (let i = 0; i < 5; i++) this.spawnThreat(r)
  }

  spawnThreat(r = rng(String(this.t))) {
    const edge = Math.floor(r() * 4)
    const p = edge === 0 ? { x: r() * W, y: -30 } : edge === 1 ? { x: W + 30, y: r() * H }
            : edge === 2 ? { x: r() * W, y: H + 30 } : { x: -30, y: r() * H }
    this.threats.push({
      ...p, r: 10, hp: 34, maxHp: 34, speed: 0.5 + r() * 0.35,
      wind: 0, striking: false, alive: true, kind: 'runner', seed: r() * 1000,
    })
  }

  /**
   * IND-34c: the single most important mechanic in the game, and it is a button that
   * removes you from danger.
   *
   * Instant. Always available. No cooldown, no channel, never blocked.
   *
   * "This is what makes permadeath fair rather than cruel. You can leave at any
   *  moment. So nothing kills you but greed, and every death is a decision you made."
   *
   * ⚠ NEVER add a cooldown, a channel time, or a boss-room block. Every one of those
   * turns a game about the player's judgement into a game about the designer's.
   *
   * The cost is the room: what you did not pick up stays out there, and the site
   * repopulates.
   *
   * What it BUYS is the pack. Carried fragments are at risk until they are banked,
   * and the recall is the only thing that banks them. Without that, this is a
   * teleport and the whole risk economy is decorative.
   */
  recall() {
    const p = this.player
    // count what greed did not get, before the site resets
    const left = this.salvage.filter(s => dist(s, p) < 420).length
    this.abandoned += left

    // THE BANK. this is the entire point of the button.
    const carried = this.pack.length
    if (carried) { this.banked.push(...this.pack); this.pack = [] }

    p.x = this.anchor.x; p.y = this.anchor.y
    p.prevX = p.x; p.prevY = p.y
    p.heat = 0; p.overheated = 0

    // the companion comes with you. it is yours and it was standing next to you.
    if (this.companion) {
      this.companion.x = this.anchor.x - 22; this.companion.y = this.anchor.y + 18
      this.companion.prevX = this.companion.x; this.companion.prevY = this.companion.y
    }

    // the site resets. threats disengage and repopulate from the edges.
    this.threats = []
    this.spawnTimer = 4
    this.bullets = []

    this.recallFlash = 1
    this.recallCount++
    sfx.recall()
    // one line, and it names both halves of the trade.
    if (carried) this.log(`you left. ${carried} kept${left ? `, ${left} still out there` : ''}.`)
    else this.log(left > 0 ? `you left with nothing. ${left} still out there.` : 'you left.')
  }

  takeChassis() {
    if (!this.chassis || this.chassis.taken) return
    this.chassis.taken = true
    const c = new Companion()
    c.x = this.chassis.x; c.y = this.chassis.y + 20
    c.prevX = c.x; c.prevY = c.y
    c.body = { ...STARTER_BODY }
    c.installed = new Array(c.body.sockets).fill(null)
    c.install(makeFragment('gait'), 0)   // it can move. that is all, at first.
    c.recompute()
    this.companion = c
    sfx.stand()
    this.log('it stands up.')
  }
}

/** the companion acts on whatever it decided. it is never commanded. */
function act(c: Companion, w: World, dt: number) {
  const p = w.player
  const speed = 1.55
  const near = w.threats.filter(t => t.alive && dist(c, t) < c.body.gpu)
                        .sort((a, b) => dist(c, a) - dist(c, b))
  const th = near[0]
  const lootNear = w.salvage.filter(s => dist(c, s) < c.body.gpu)
                            .sort((a, b) => dist(c, a) - dist(c, b))[0]
  const interesting = w.interest.find(i => !i.seen && dist(c, i) < c.body.gpu)

  let tx = p.x, ty = p.y + 26
  c.exposure = 0

  switch (c.behaviour) {
    case 'engage': if (th) { tx = th.x; ty = th.y; c.exposure = 0.8 } break
    case 'cover':  if (th) { tx = th.x + (p.x - th.x) * 0.3; ty = th.y + (p.y - th.y) * 0.3; c.exposure = 1 } break
    case 'repair': tx = p.x; ty = p.y; c.exposure = 0.5; break
    case 'salvage': if (lootNear) { tx = lootNear.x; ty = lootNear.y; c.exposure = 0.35 } break
    case 'investigate':
      if (interesting) { tx = interesting.x; ty = interesting.y }
      else { if (!c.poi || dist(c, c.poi) < 26) c.poi = { x: 60 + Math.random() * (W - 120), y: 60 + Math.random() * (H - 120) }; tx = c.poi.x; ty = c.poi.y }
      break
    case 'flee': {
      const away = th ?? p
      tx = c.x + (c.x - away.x); ty = c.y + (c.y - away.y)
      break
    }
  }

  c.prevX = c.x; c.prevY = c.y
  const d = Math.hypot(tx - c.x, ty - c.y)
  if (d > 4) { c.x += (tx - c.x) / d * speed; c.y += (ty - c.y) / d * speed }
  c.x = clamp(c.x, 12, W - 12); c.y = clamp(c.y, 12, H - 12)

  // battery: sustained activity drains, standing near the player recovers
  const busy = c.behaviour === 'engage' || c.behaviour === 'cover' || c.behaviour === 'flee'
  c.charge = clamp(c.charge + (busy ? -dt * 0.10 : dt * 0.16), 0, 1)

  if (c.behaviour === 'engage' && th && dist(c, th) < 30) th.hp -= 20 * dt
  if (c.behaviour === 'cover' && th && dist(c, th) < 44) th.hp -= 9 * dt

  if (c.behaviour === 'repair' && dist(c, p) < 30 && c.repairCd <= 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + 15); c.repairCd = 2.4; sfx.repair()
  }
  c.repairCd = Math.max(0, c.repairCd - dt)

  if (c.behaviour === 'salvage' && lootNear && dist(c, lootNear) < 16) {
    if (lootNear.frag) w.pack.push(makeFragment(lootNear.frag))
    w.salvage.splice(w.salvage.indexOf(lootNear), 1)
    sfx.pickup()
  }

  // IND-34m: it stops at a thing worth nothing, and that is the only acknowledgement
  // the beautiful thing ever gets.
  if (c.behaviour === 'investigate' && interesting && dist(c, interesting) < 22) {
    interesting.seen = true
    w.log(`${c.name || 'it'} stopped, and looked at something.`)
  }
}

export function simulate(
  w: World, dt: number, mv: { x: number; y: number }, firing: boolean,
  aim: { x: number; y: number }, recalling = false,
) {
  w.t += dt
  const p = w.player

  // ⚠ handled FIRST, before movement, threats or anything else can intervene.
  // The recall is instant or it is not a recall.
  if (recalling) w.recall()
  w.recallFlash = Math.max(0, w.recallFlash - dt * 2.2)

  // ── player ──
  p.prevX = p.x; p.prevY = p.y
  p.x = clamp(p.x + mv.x * 2.5, 12, W - 12)
  p.y = clamp(p.y + mv.y * 2.5, 12, H - 12)
  p.retreating = false

  // IND-34j: heat, not ammo. sustained fire locks the weapon for ~2s.
  p.fireCd = Math.max(0, p.fireCd - dt)
  p.overheated = Math.max(0, p.overheated - dt)
  if (firing && p.overheated <= 0 && p.fireCd <= 0) {
    const a = Math.atan2(aim.y - p.y, aim.x - p.x)
    w.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 1.1, from: 'player' })
    p.fireCd = 0.14
    p.heat = Math.min(1, p.heat + 0.075)
    sfx.fire()
    if (p.heat >= 1) { p.overheated = 2; p.heat = 1; sfx.overheat(); w.log('the driver is too hot to fire.') }
  } else {
    p.heat = Math.max(0, p.heat - dt * (p.overheated > 0 ? 0.55 : 0.30))
  }

  // ── bullets ──
  for (let i = w.bullets.length - 1; i >= 0; i--) {
    const b = w.bullets[i]
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > W || b.y > H) { w.bullets.splice(i, 1); continue }
    for (const t of w.threats) {
      if (!t.alive || Math.hypot(b.x - t.x, b.y - t.y) > t.r + 3) continue
      t.hp -= 12
      w.bullets.splice(i, 1)
      hitstop(t.hp <= 0 ? 90 : 40)      // game-feel: hitstop before particles
      sfx.hit()
      break
    }
  }

  // ── threats. they telegraph enormously, because they were built to be safe
  //    around humans and that safety system is one of the few things still working. ──
  for (const t of w.threats) {
    if (!t.alive) continue
    const targets: { x: number; y: number }[] = [p]
    if (w.companion) targets.push(w.companion)
    const tgt = targets.sort((a, b) => dist(t, a) - dist(t, b))[0]
    const d = dist(t, tgt)
    if (d < 56) { t.wind += dt; t.striking = t.wind > 0.55 }
    else { t.wind = Math.max(0, t.wind - dt * 2); t.striking = false
           t.x += (tgt.x - t.x) / d * t.speed; t.y += (tgt.y - t.y) / d * t.speed }
    if (t.striking && t.wind > 0.95) {
      t.wind = 0
      if (dist(t, tgt) < 58) {
        if (tgt === p) { p.hp -= 12; p.lastHurt = w.t; sfx.hurt(); hitstop(70) }
        else if (w.companion) { w.companion.hp -= 12; sfx.hurt() }
      }
    }
    if (t.hp <= 0) {
      t.alive = false
      w.salvage.push({ x: t.x, y: t.y, frag: Math.random() < 0.22 ? pickFrag() : null })
      sfx.destroy()
    }
  }
  w.threats = w.threats.filter(t => t.alive || dist(t, p) < 900)

  w.spawnTimer -= dt
  if (w.spawnTimer <= 0 && w.threats.filter(t => t.alive).length < 7) {
    w.spawnThreat(); w.spawnTimer = 3.2 + Math.random() * 3
  }

  // ── the player picks up what they walk over ──
  for (let i = w.salvage.length - 1; i >= 0; i--) {
    if (dist(p, w.salvage[i]) < 18) {
      const s = w.salvage[i]
      if (s.frag) { w.pack.push(makeFragment(s.frag)); w.log(`recovered: ${makeFragment(s.frag).name}`) }
      w.salvage.splice(i, 1); sfx.pickup()
    }
  }

  if (w.chassis && !w.chassis.taken && dist(p, w.chassis) < 26) w.takeChassis()

  // ── the companion ──
  if (w.companion) {
    decide(w.companion, w, dt)
    act(w.companion, w, dt)
    if (w.companion.hp <= 0) { w.companion.hp = 1; w.log(`${w.companion.name || 'it'} is badly damaged.`) }
  }

  // Death is still a stub (the real one lands with THE FIRST LOSS), but the COST is
  // real now, because it is what gives the recall its meaning. Carried is lost.
  // ⚠ Not dropped on the ground to be retrieved ... that is a different game. IND-34
  // is ROTMG permadeath: what you had is gone.
  if (p.hp <= 0) {
    const lost = w.pack.length
    w.pack = []
    p.hp = p.maxHp
    p.x = w.anchor.x; p.y = w.anchor.y; p.prevX = p.x; p.prevY = p.y
    p.heat = 0; p.overheated = 0
    w.threats = []; w.bullets = []; w.spawnTimer = 4
    w.recallFlash = 1
    w.log(lost ? `you would have died here. ${lost} lost.` : 'you would have died here.')
  }
}

const FRAG_POOL = ['attend', 'repair', 'salvage', 'ward', 'prudence', 'pursuit', 'inquiry', 'brace', 'selfpres', 'mark']
const pickFrag = () => FRAG_POOL[Math.floor(Math.random() * FRAG_POOL.length)]
