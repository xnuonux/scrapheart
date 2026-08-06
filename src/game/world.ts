// THE HALT. IND-34b: a transit interchange where several thousand machines stopped
// mid-journey and never resumed. Densely packed, mostly harmless. The density is the
// tutorial ... a new player learns what a wreck looks like by standing in ten thousand.

import { Companion, decide, perceive, STARTER_BODY } from './companion'
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
  kind: 'runner' | 'stopped' | 'warden'
  seed: number
  announced?: boolean
}

/**
 * IND-34k. Somebody else's design. No sockets, no fragments, nothing to assemble.
 * You cannot improve it and you cannot command it. It fights a little, badly, and
 * it is good company.
 *
 * ⚠ It follows you into anything, and you cannot tell it not to. That is not a
 * scripted behaviour for one beat ... it is what a handler IS, in every zone, forever.
 */
export interface Handler {
  x: number; y: number; prevX: number; prevY: number
  hp: number; alive: boolean; r: number
  fireCd: number
  bob: number
}

export interface Bullet { x: number; y: number; vx: number; vy: number; life: number; from: 'player' | 'comp' | 'handler' }
/** IND-34i: a fragment a mind actually lived in has not fully stopped. it glows. */
export interface Salvage { x: number; y: number; frag: string | null; worn?: number }
/** IND-34m: things worth finding that are worth nothing. no pickup, no counter. */
export interface Interest {
  x: number; y: number; seen: boolean; kind: 'view' | 'arrangement' | 'lamp'
  /**
   * How hard it pulls. 1 is a nice view. ⚠ IND-34k's heart is the only thing in the
   * game above 1, because it is the only thing a frightened machine would still cross
   * a field to look at. A fragment a mind lived in its whole existence is not scenery.
   */
  pull?: number
}

export const W = 1600, H = 1200
/**
 * IND-34k step 2: "you go deeper, because the salvage is better and that is the whole
 * economy." At P0 there is one zone, so deeper is east. ⚠ No wall, no gate, no text,
 * no warning. The only thing marking it is the corridor of aftermath leading in, and
 * a player is free to read that as scenery. Everyone keeps going. That is the game.
 */
export const DEEP_X = 1080

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
  /** IND-34k: it is just there, and then it is with you. */
  handler: Handler | null = null
  handlerMet = false
  handlerLostAt = -1
  wardenSpawned = false
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
    // ⚠ Playtest 2026-08-06: the whole log read "it broke off." six times. Behaviour
    // transitions oscillate (the scorer has jitter, by design), and every entry logged.
    // A repeated line is worse than no line ... it trains the player to stop reading,
    // which costs every message that actually matters.
    const top = this.logs[0]
    if (top && top.text === text && this.t - top.t < 8) { top.t = this.t; return }
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
    // IND-34k step 3: THE CORRIDOR. Things already destroyed, in a line, leading east.
    // ⚠ This is the warden's introduction and it needs no text. A player who reads it
    // correctly slows down. A player who does not is the one the beat is written for,
    // and there is no penalty for being either.
    for (let i = 0; i < 26; i++) {
      const t = i / 25
      this.wrecks.push({
        x: 860 + t * 620 + (r() - 0.5) * 70,
        y: H / 2 + Math.sin(t * 2.4) * 90 + (r() - 0.5) * 80,
        s: 9 + r() * 13, seed: r() * 1000,
      })
    }

    // deeper is worth it. that is the whole economy, and it has to be true or the
    // player never goes and the beat never happens.
    for (let i = 0; i < 11; i++) {
      this.salvage.push({
        x: DEEP_X + 60 + r() * (W - DEEP_X - 140), y: 110 + r() * (H - 220),
        frag: i < 7 ? ['inquiry', 'pursuit', 'prudence', 'brace', 'ward', 'mark', 'salvage'][i] : null,
      })
    }

    for (let i = 0; i < 5; i++) this.spawnThreat(r)
  }

  /**
   * IND-34k step 1. Not given, not a quest. It is just there, and then it is with you.
   * ⚠ No foreshadowing of any kind. No ominous cue, no camera linger, no name in a
   * quest log. The moment the game signals this is a Sad Beat it becomes one and
   * stops working.
   */
  spawnHandler() {
    if (this.handler || this.handlerMet) return
    const p = this.player
    this.handler = {
      x: clampW(p.x - 120), y: clampH(p.y + 90),
      prevX: p.x - 120, prevY: p.y + 90,
      hp: 30, alive: true, r: 6, fireCd: 0, bob: 0,
    }
    this.handlerMet = true
    this.log('something small is following you.')
  }

  /**
   * 🚨 THE PERMANENT RULE, not a scripted death. A warden one-shots a handler. Always,
   * everywhere, forever.
   *
   * Not targeting it. Not malice. The handler is a thing that moves, and a warden's
   * only surviving instruction is ENGAGE HOSTILES with no definition of hostile left.
   * It kills the dog with exactly as much feeling as it kills a crate.
   *
   * ⚠ Players will try to save it. They must not be able to, or the ones who could not
   * feel cheated.
   */
  killHandler() {
    const h = this.handler
    if (!h || !h.alive) return
    h.alive = false
    this.handlerLostAt = this.t
    hitstop(160)
    sfx.destroy()

    // IND-34k: something in it is still on. The first glowing fragment the player ever
    // sees, and it belonged to someone they knew.
    this.salvage.push({ x: h.x, y: h.y, frag: 'heart', worn: 1 })
    // and it is a thing worth looking at, so the companion's OWN curiosity brings it
    // there. ⚠ not scripted. the system already does this (see score(): investigate).
    //
    // The pull is what makes it survive fear. Measured first pass: with the warden
    // still alive the threat damping cut investigate to 12% and the companion came no
    // closer than 118px, so the emotional centre of the beat quietly did not happen.
    this.interest.push({ x: h.x, y: h.y, seen: false, kind: 'lamp', pull: 5 })

    this.log('it stops moving.')
  }

  spawnWarden() {
    if (this.wardenSpawned) return
    this.wardenSpawned = true
    const p = this.player
    this.threats.push({
      x: clampW(p.x + 300), y: clampH(p.y - 60),
      r: 26, hp: 340, maxHp: 340, speed: 0.42,
      wind: 0, striking: false, alive: true, kind: 'warden', seed: 7, announced: false,
    })
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
   * Leaving the site, however you left it. ONE implementation, because there are two
   * ways out (the recall and dying) and they must not drift apart.
   *
   * ⚠ They already did. The recall was taught to preserve the warden and the death
   * path was not, so dying once deleted the warden forever while `wardenSpawned`
   * stayed true and blocked the respawn. Caught by the IND-34k probe, which got as
   * far as "you would have died here" and then found no warden and no beat.
   */
  resetSite() {
    // The warden is NOT cleared. It is not a wandering runner, it is a unit clearing an
    // area, and IND-34k step 8 depends on it: you go back, your choice, no prompt, no
    // marker, and the scrap is where you left it. An exit that deleted it would turn
    // leaving into winning.
    const warden = this.threats.find(t => t.alive && t.kind === 'warden')
    this.threats = []
    if (warden) {
      warden.x = clampW(Math.max(warden.x, DEEP_X + 120)); warden.wind = 0; warden.striking = false
      this.threats.push(warden)
    }
    this.spawnTimer = 4
    this.bullets = []
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

    this.resetSite()

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
  // ⚠ ONE perception, shared with the scorer. These were two copies and they drifted:
  // the mind decided to go somewhere the body could not see. See perceive().
  const { nearest: th, lootNear, interesting } = perceive(c, w)

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

/**
 * The handler. It follows, and it fights a little, badly.
 *
 * ⚠ It must be genuinely good company on its own terms. If it is only there to die,
 * players feel handled. So it helps in real fights, it keeps pace, and it bobs.
 */
function actHandler(h: Handler, w: World, dt: number) {
  const p = w.player
  h.prevX = h.x; h.prevY = h.y
  h.bob += dt * 7

  h.fireCd = Math.max(0, h.fireCd - dt)
  const th = w.threats.filter(t => t.alive && dist(h, t) < 230)
                      .sort((a, b) => dist(h, a) - dist(h, b))[0]

  // ⚠ It goes AT things. Not because the beat needs it to ... because that is what it
  // is. A handler that hangs back behind you is not a handler, it is an escort mission.
  //
  // The first probe run found it trailing 42px behind the player, which meant the
  // PLAYER died to the warden while the handler stood safely in the back. The beat
  // never fired, and the version of the dog that produced that is also just a worse dog.
  let tx = p.x, ty = p.y
  if (th) { tx = th.x; ty = th.y }
  const dT = Math.hypot(tx - h.x, ty - h.y)
  const stop = th ? 52 : 42
  if (dT > stop) {
    const sp = Math.min(2.4, 1.55 + dT * 0.006)
    h.x += (tx - h.x) / dT * sp; h.y += (ty - h.y) / dT * sp
  }
  h.x = clamp(h.x, 12, W - 12); h.y = clamp(h.y, 12, H - 12)
  if (th && h.fireCd <= 0) {
    const a = Math.atan2(th.y - h.y, th.x - h.x) + (Math.random() - 0.5) * 0.34  // badly
    w.bullets.push({ x: h.x, y: h.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, life: 0.8, from: 'handler' })
    h.fireCd = 0.55
    sfx.fire()
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
    const warden = t.kind === 'warden'

    // IND-34k step 5: it announces itself. Politely, because announcing was part of
    // the procedure. ⚠ No threat, no menace, no villain voice. It is doing its job.
    if (warden && !t.announced) {
      t.announced = true
      sfx.announce()
      w.log('UNIT 7. AREA IS BEING CLEARED. PLEASE STAND AWAY.')
    }

    // ⚠ a warden's only surviving instruction is ENGAGE HOSTILES with no definition of
    // hostile left, so it targets whatever moves and is nearest. it does not prefer
    // the handler and it does not spare it.
    const targets: { x: number; y: number }[] = [p]
    if (w.companion) targets.push(w.companion)
    // ⚠ Only a warden counts the handler as a target. Runners ignore it ... it is
    // another transit machine as far as they are concerned, and if random runners
    // could kill it the player would spend the first half hour nursing it instead of
    // enjoying it. The handler has to be good company, not an escort mission.
    if (warden && w.handler?.alive) targets.push(w.handler)
    const tgt = targets.sort((a, b) => dist(t, a) - dist(t, b))[0]
    const d = dist(t, tgt)
    const reach = warden ? 92 : 56
    if (d < reach) { t.wind += dt; t.striking = t.wind > (warden ? 0.85 : 0.55) }
    else { t.wind = Math.max(0, t.wind - dt * 2); t.striking = false
           t.x += (tgt.x - t.x) / d * t.speed; t.y += (tgt.y - t.y) / d * t.speed }
    if (t.striking && t.wind > (warden ? 1.5 : 0.95)) {
      t.wind = 0
      const hitR = warden ? 96 : 58
      if (dist(t, tgt) < hitR) {
        if (tgt === p) { p.hp -= warden ? 30 : 12; p.lastHurt = w.t; sfx.hurt(); hitstop(warden ? 120 : 70) }
        else if (tgt === w.handler) w.killHandler()
        else if (w.companion) { w.companion.hp -= warden ? 34 : 12; sfx.hurt() }
      }
    }

    // 🚨 the permanent rule, enforced regardless of what the warden was aiming at.
    // a handler that is anywhere near a swinging warden dies. always. everywhere.
    if (warden && w.handler?.alive && dist(t, w.handler) < 78) w.killHandler()

    if (t.hp <= 0) {
      t.alive = false
      w.salvage.push({ x: t.x, y: t.y, frag: warden ? 'selfpres' : Math.random() < 0.22 ? pickFrag() : null })
      sfx.destroy()
      // ⚠ and when it stops, nothing is said. no text, no reward screen, no
      // acknowledgement of what the player just carried into that room.
      if (warden) hitstop(220)
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
      if (s.frag) {
        const f = makeFragment(s.frag, s.worn ?? 0)
        w.pack.push(f)
        w.log(`recovered: ${f.name}`)
      }
      w.salvage.splice(i, 1); sfx.pickup()
    }
  }

  if (w.chassis && !w.chassis.taken && dist(p, w.chassis) < 26) w.takeChassis()

  // ── IND-34k, the beat. Assembled from two permanent rules, introduced once. ──
  //
  // step 1: the handler finds you. after the companion is standing, so the player
  // already knows what a machine of their own feels like.
  if (!w.handlerMet && w.chassis?.taken && w.t > 40) w.spawnHandler()
  if (w.handler?.alive) actHandler(w.handler, w, dt)

  // step 4: you keep going. everyone keeps going.
  // ⚠ the warden is placed, and that is admitted. what must be real is the RULE, and
  // the rule holds for the rest of the game.
  if (!w.wardenSpawned && w.handler?.alive && p.x > DEEP_X) w.spawnWarden()

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
    w.resetSite()
    w.recallFlash = 1
    w.log(lost ? `you would have died here. ${lost} lost.` : 'you would have died here.')
  }
}

const FRAG_POOL = ['attend', 'repair', 'salvage', 'ward', 'prudence', 'pursuit', 'inquiry', 'brace', 'selfpres', 'mark']
const pickFrag = () => FRAG_POOL[Math.floor(Math.random() * FRAG_POOL.length)]
