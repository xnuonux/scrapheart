// THE HALT. IND-34b: a transit interchange where several thousand machines stopped
// mid-journey and never resumed. Densely packed, mostly harmless. The density is the
// tutorial ... a new player learns what a wreck looks like by standing in ten thousand.

import { Companion, decide, perceive, socketCount, STARTER_BODY } from './companion'
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
  /**
   * IND-34n: `caster` exists because every other shape here is melee, and a field of
   * pure melee has exactly one verb ... walk away. RotMG's threat reaches you from
   * 13.5 tiles against a best-in-game weapon at 9.0, and reading patterns at range IS
   * the game. A caster keeps its distance and shoots, so there is something to dodge.
   */
  kind: 'runner' | 'stopped' | 'warden' | 'caster'
  seed: number
  announced?: boolean
  fireCd?: number
  /**
   * IND-34l · wardens by degree. 1 is intact: announces, then kills everything that
   * moves. 2 announced and CANNOT follow through ... its targeting is gone, and it will
   * give the warning again every time you pass, for as long as the game exists.
   *
   * ⚠ The RULE stays absolute (a warden that can act one-shots a handler, always). What
   * varies is whether it can act at all. That is how `34k`'s certainty and `34l`'s
   * variance both hold.
   */
  degree?: 1 | 2
  /** it re-announces every time you come back into range. that is the whole beat. */
  rearmAt?: number
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

export interface Bullet {
  x: number; y: number; vx: number; vy: number; life: number
  from: 'player' | 'comp' | 'handler' | 'threat'
}
/** IND-34i: a fragment a mind actually lived in has not fully stopped. it glows. */
export interface Salvage { x: number; y: number; frag: string | null; worn?: number }
/**
 * IND-34i · weather that targets ORGANS. Dust attacks GPU, so perception collapses and
 * the same storm is trivial for one companion and crippling for another. Weather stops
 * being a nuisance modifier and becomes a build check.
 *
 * 🚨 THE ONE RULE THAT CANNOT BE COMPROMISED FOR DRAMA: it is visible from a long way
 * off and it is avoidable. Weather that is not visible from a distance is a random
 * punishment, and `34c`'s central law is that nothing kills you but greed. It also
 * MOVES, slowly, so where it is becomes information worth having.
 */
export interface Weather {
  x: number; y: number; r: number
  vx: number; vy: number
  kind: 'dust'
  /** 0 at the edges of its life, 1 at full strength. it arrives and it leaves. */
  strength: number
  age: number; life: number
}

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

/**
 * IND-34n, the whole calibration in one function. 0 at the anchor, 1 at the east edge.
 *
 * 🚨 RotMG holds hits-to-die at ~5 across an ENTIRE character life, and gives the first
 * hour roughly 3x that margin (its opening enemy is 70hp / 9 damage against 150hp ...
 * sixteen hits). SCRAPHEART was doing the reverse: a flat 12-damage runner from the
 * first second, seven of them at once, all melee, and a 30-damage warden ten minutes
 * in. Four consecutive automated runs died in the deep and never once died in the
 * shallows, which is the curve backwards.
 *
 * ⚠ Depth is measured from the PLAYER, not from the threat, so walking east is what
 * raises the stakes and walking home is what lowers them. There is no wall and no
 * warning, which is the same rule the salvage already follows.
 */
export const depthAt = (x: number) => Math.max(0, Math.min(1, (x - 340) / (W - 480)))

/**
 * How deep inside the weather a point is. 0 outside, 1 at the core.
 * ⚠ Soft-edged on purpose ... a hard boundary would make it a room, and this is meant
 * to be a thing you watch approach and decide about.
 */
export function inWeather(w: World, p: { x: number; y: number }): number {
  const wx = w.weather
  if (!wx) return 0
  const d = Math.hypot(p.x - wx.x, p.y - wx.y)
  if (d > wx.r) return 0
  return Math.min(1, (1 - d / wx.r) * 1.8) * wx.strength
}

/**
 * 🚨 THE TUNING KNOB, and the one number in this file that a playtest owns rather than
 * a measurement.
 *
 * `IND-34k` asks for 20-30 minutes of the handler being genuinely good company before
 * it dies, and is explicit that if it is only there to die, players feel handled. But
 * the P0 gate is a ONE HOUR session, and the beat has to land inside it with room left
 * to breathe afterwards.
 *
 * ⚠ 8 minutes is the compromise, and it is a guess. Watch a real person: if the dog
 * still feels like a device rather than a companion when the warden arrives, this
 * number is too small, and it is the only thing that needs changing.
 */
const HANDLER_GRACE = 480

/**
 * How close a threat has to be before the player has plainly seen it themselves, so a
 * companion looking at it is news rather than an echo. Roughly two-thirds of a screen
 * half-width at 1280 ... comfortably on screen and noticed.
 * ⚠ Marking only means anything in the band between this and the companion's reach.
 */
const MARK_OBVIOUS = 420

/** damage a runner deals at a given depth. ~14 hits at the anchor, ~4.5 in the deep. */
const runnerDamage = (d: number) => 7 + d * 15
/** a caster reaches you. it hits softer than a runner because reach IS the threat. */
const casterDamage = (d: number) => 6 + d * 10

const dist = (a: {x:number,y:number}, b: {x:number,y:number}) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * 🚨 Is this thing a THREAT, or is it furniture that happens to live in the same array?
 *
 * `IND-34l`'s stopped ones share the Threat type because they are shootable and they
 * are salvage. They are not dangerous and they never do anything. ⚠ Every `threats`
 * filter written before they existed silently counts them, which meant the companion
 * scored `flee` against a machine that gave up, the handler charged over to shoot
 * furniture, and standing near one **suppressed curiosity** ... so the objects that ARE
 * the atmosphere were switching the atmosphere system off.
 *
 * One predicate. If a fourth kind ever arrives, it declares itself here.
 */
export const isHostile = (t: Threat) => t.alive && t.kind !== 'stopped'
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
  /**
   * IND-34c: your companion does not die. It is a machine and it was standing next to
   * you. It watched. It stays where you fell, and it waits.
   */
  waiting: { x: number; y: number; c: Companion; since: number } | null = null
  /** the run counter. permadeath means there is more than one. */
  run = 1
  runStarted = 0
  /** fame, in the ROTMG sense: the only thing a dead character leaves behind. */
  records: { run: number; seconds: number; kept: number; deepest: number }[] = []
  deepest = 0
  deathFlash = 0
  interposes = 0
  /** how long the player has been holding a repair on the companion */
  mending = 0
  /** IND-34i. One at a time at P0; the doc says five weathers is two too many. */
  weather: Weather | null = null
  weatherTimer = 55

  /** IND-34k: it is just there, and then it is with you. */
  handler: Handler | null = null
  handlerMet = false
  handlerMetAt = -1
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

    // ── IND-34l · THE ONES THAT GAVE UP ──
    //
    // `34b`'s The Still is machines that CHOSE: they walked somewhere, arranged
    // themselves, powered down. Deliberate, almost dignified. This is the other thing:
    // machines that stopped WHERE THEY WERE.
    //
    // 🚨 Still on. ⚠ That is the entire mechanic. A machine that is off is dead and
    // reads as scenery. A machine that is on, and doing nothing, has decided something.
    //
    // ⚠ Found individually, never in groups. The Still is the group. This is one,
    // somewhere, that did not make it there. So they are spread deliberately far apart
    // and never near the opening.
    const spots = [
      { x: 300, y: 260 }, { x: 1180, y: 250 }, { x: 430, y: 980 },
      { x: 1420, y: 900 }, { x: 900, y: 190 }, { x: 1300, y: 640 },
    ]
    for (const s of spots) {
      this.threats.push({
        x: s.x + (r() - 0.5) * 90, y: s.y + (r() - 0.5) * 90,
        r: 11, hp: 30, maxHp: 30, speed: 0,
        wind: 0, striking: false, alive: true, kind: 'stopped', seed: r() * 1000,
      })
    }

    // ⚠ IND-34l: "rare, unmarked, and placed somewhere a player has no reason to be."
    // Nothing points at it. Most players will never find it. The ones who do will not
    // be sure what they are looking at for a while, which is the point.
    this.threats.push({
      x: 1460, y: 1080, r: 26, hp: 340, maxHp: 340, speed: 0,
      wind: 0, striking: false, alive: true, kind: 'warden', seed: 12,
      announced: false, degree: 2,
    })

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
    this.handlerMetAt = this.t
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

  /** how blind the dust makes something at this position. 0..1 */
  dustAt(p: { x: number; y: number }) { return inWeather(this, p) }

  /**
   * IND-34i: it arrives from off-map and crosses. ⚠ It is spawned OUTSIDE the world so
   * the player watches it come in, which is the entire difference between weather and
   * a random punishment.
   */
  spawnWeather() {
    const r = this.spawnRng
    const fromWest = r() < 0.5
    this.weather = {
      x: fromWest ? -320 : W + 320,
      y: 200 + r() * (H - 400),
      r: 300 + r() * 190,
      vx: (fromWest ? 1 : -1) * (17 + r() * 12),
      vy: (r() - 0.5) * 9,
      kind: 'dust',
      strength: 0, age: 0, life: 78 + r() * 40,
    }
    this.log('there is dust on the horizon.')
  }

  spawnWarden() {
    if (this.wardenSpawned) return
    this.wardenSpawned = true
    const p = this.player
    this.threats.push({
      x: clampW(p.x + 300), y: clampH(p.y - 60),
      r: 26, hp: 340, maxHp: 340, speed: 0.42,
      wind: 0, striking: false, alive: true, kind: 'warden', seed: 7, announced: false,
      degree: 1,
    })
  }

  /**
   * ⚠ ONE persistent runtime stream, drawn sequentially. It used to be
   * `spawnThreat(r = rng(String(this.t)))`, which built a FRESH seeded generator on
   * every spawn and only ever read its first value. Adjacent seeds do not produce
   * independent first draws, so `r() < 0.22 + d * 0.26` stopped behaving like a
   * probability and became a hard threshold: measured 0% casters below it and 100%
   * above. Law 7 asks for replayable, not re-seeded.
   */
  spawnRng = rng('halt-spawns')

  spawnThreat(r = this.spawnRng) {
    // ⚠ Threats are built for where the PLAYER is, not for the edge they walk in from.
    // IND-34n: the opening tier has to carry roughly 3x the margin of the deep, and the
    // tightening has to be continuous rather than a wall you cross.
    const d = depthAt(this.player.x)
    const edge = Math.floor(r() * 4)
    const p = edge === 0 ? { x: r() * W, y: -30 } : edge === 1 ? { x: W + 30, y: r() * H }
            : edge === 2 ? { x: r() * W, y: H + 30 } : { x: -30, y: r() * H }

    // casters only exist past the shallows. the first thing a player learns is walking,
    // and the second is that walking stops being enough.
    const caster = d > 0.34 && r() < 0.22 + d * 0.26
    const hp = caster ? 20 + d * 26 : 24 + d * 30
    this.threats.push({
      ...p, r: caster ? 9 : 10, hp, maxHp: hp,
      speed: caster ? 0.34 + r() * 0.2 : 0.5 + r() * 0.35,
      wind: 0, striking: false, alive: true,
      kind: caster ? 'caster' : 'runner', seed: r() * 1000, fireCd: 1.2 + r(),
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
    // ⚠ ALL of them, and the stopped ones too. There are two wardens now (one intact,
    // one that gave the warning and cannot follow through) and `find` would have kept
    // exactly one, silently deleting whichever it did not pick. The stopped ones are
    // part of the world's furniture and clearing them would mean the field quietly
    // empties itself every time the player goes home.
    const keep = this.threats.filter(t => t.alive && (t.kind === 'warden' || t.kind === 'stopped'))
    this.threats = []
    for (const k of keep) {
      if (k.kind === 'warden' && k.degree !== 2) {
        k.x = clampW(Math.max(k.x, DEEP_X + 120))
      }
      k.wind = 0; k.striking = false
      this.threats.push(k)
    }
    this.spawnTimer = 4
    this.bullets = []
  }

  /**
   * IND-34a §it saves you. Three things must be true at once, and none of them is a
   * die roll:
   *
   *   1. CAPABILITY  ... a fragment installed that can act in that window
   *   2. DISPOSITION ... its weights favour you over itself. ⚠ Self-preservation
   *                      fragments make this LESS likely, and they are otherwise very
   *                      good fragments.
   *   3. HISTORY     ... you repaired it when it was damaged, not only when convenient
   *
   * 🚨 So a player who used it as a tool will watch it calculate correctly and let them
   * die, and the game never explains why. A message saying "your companion did not
   * value you enough" would be unbearable and would also be a lie about how this works.
   *
   * Returns true if it took the hit.
   */
  tryInterpose(incoming: number): boolean {
    const c = this.companion, p = this.player
    if (!c || !c.can.interpose) return false           // 1 · capability
    if (dist(c, p) > 96) return false                  // it has to be able to reach
    // only for a hit that actually threatens you. it is not a damage sponge.
    if (p.hp - incoming > p.maxHp * 0.34) return false

    // 2 · disposition, 3 · history. ⚠ No randomness. The same machine in the same state
    // makes the same choice, which is the only way a player can ever learn what they
    // built rather than what they rolled.
    // ⚠ Tuned so history is EARNED, not tapped. With the heart installed, disposition
    // alone reaches 0.98 and the bar is 1.30, so roughly three seconds of mending under
    // fire (or eight of it in safety) is the difference between a machine that reaches
    // for you and one that does not. A one-second bar would have made condition 3 a
    // formality wearing the language of a relationship.
    const history = Math.min(1, c.careShown / 6)
    const willingness = c.loyalty * 1.0 + history * 0.9 - c.caution * 0.35
    if (willingness < 1.30) return false

    // and it costs it the piece that let it. ⚠ Not random ... whichever fragment it
    // used to do it. The thing that made it able to save you is the thing that saving
    // you consumed.
    const slot = c.installed.findIndex(f => f?.grants?.includes('interpose'))
    if (slot < 0) return false
    const used = c.installed[slot]!
    c.installed[slot] = null
    c.recompute()

    c.hp = Math.max(1, c.hp - incoming)
    p.lastHurt = this.t
    hitstop(260)
    sfx.destroy()
    // ⚠ Plain. No fanfare, no explanation. The empty socket is the sentence.
    // IND-34a: a scar expressed as a mechanic, with no writing at all.
    this.log(`${c.name || 'it'} moved into it. ${used.name} is gone.`)
    this.interposes++
    return true
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

  /**
   * IND-34c §what death means. You die permanently. Character gone, gear gone, fame
   * recorded, start again.
   *
   * 🚨 And your companion does NOT die. It is a machine and it was standing next to
   * you. It watched. It stays where you fell and it waits, and it is visible in the
   * world, and going back for it is a real expedition because you are now weak.
   *
   * ⚠ Everything you assembled survives. The relationship does not, entirely. That is
   * the whole resolution of permadeath plus a forty-hour companion, and the teeth stay
   * in only because the gear and the character really are gone.
   */
  die() {
    const p = this.player

    // fame. the only thing a dead character leaves behind.
    this.records.unshift({
      run: this.run,
      seconds: Math.round(this.t - this.runStarted),
      kept: this.banked.length,
      deepest: Math.round(this.deepest),
    })
    if (this.records.length > 5) this.records.pop()

    // it stays where you fell. it waits.
    if (this.companion) {
      const c = this.companion
      c.x = p.x; c.y = p.y; c.prevX = c.x; c.prevY = c.y
      c.behaviour = 'follow'; c.warm.clear(); c.swapCd = 0
      c.hp = c.maxHp
      this.waiting = { x: p.x, y: p.y, c, since: this.t }
      this.companion = null
    }

    // gear gone. ⚠ BOTH of them. banked is safe from a recall, not from dying, or
    // there is no permadeath ... only an inconvenient checkpoint.
    this.pack = []
    this.banked = []

    // the handler was somebody else's machine and it does not survive you either.
    this.handler = null

    this.run++
    this.runStarted = this.t
    this.deepest = 0
    p.hp = p.maxHp; p.heat = 0; p.overheated = 0
    p.x = this.anchor.x; p.y = this.anchor.y; p.prevX = p.x; p.prevY = p.y
    this.resetSite()
    this.deathFlash = 1
    hitstop(320)
    sfx.destroy()

    this.log('you die here.')
    if (this.waiting) this.log('it is still standing where you fell.')
  }

  /**
   * Going back for it. ⚠ It does not simply resume: the fragments are intact and you
   * are not the same person. It follows a new character cautiously, and you earn the
   * rest back.
   */
  retrieve() {
    if (!this.waiting || this.companion) return
    const c = this.waiting.c
    c.bond = 0.4
    c.recompute()
    this.companion = c
    this.waiting = null
    sfx.stand()
    this.log(`${c.name || 'it'} follows you. not like before.`)
  }

  takeChassis() {
    if (!this.chassis || this.chassis.taken) return
    this.chassis.taken = true
    const c = new Companion()
    c.x = this.chassis.x; c.y = this.chassis.y + 20
    c.prevX = c.x; c.prevY = c.y
    c.body = { ...STARTER_BODY }
    // ⚠ sockets + auxSockets. sizing on `sockets` alone silently dropped every shaped
    // slot the body declared, which is how `auxSockets` stayed invisible.
    c.installed = new Array(socketCount(c.body)).fill(null)
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

  // BEHAVIOUR-DEFAULT: follow
  // ⚠ `follow` has no case below ... it IS this, the target before the switch runs. That
  // is legitimate, but it was only discoverable by noticing an absence, and the audit
  // correctly flagged it as "scored but never acted on". Declared rather than implied.
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

  // ── MARKING (IND-34c). no marker, no line. it looks, and you learn to read it. ──
  c.marked = null
  if (c.can.mark) {
    // ⚠ the early warning is the RANGE: it notices past what you can see, so its posture
    // is information you could not have had. a low-GPU machine marks late and is "a
    // liability you love"; a high-GPU one is why you survive.
    // ⚠ THE BAND HAS TO BE REAL. First numbers gave a reach of gpu*1.9 = 323px against a
    // "you already see it" gate of 300px, so marking could only ever fire in a 23-pixel
    // shell and measured as dead. The window is the mechanic: below MARK_OBVIOUS the
    // player can see it themselves and a posture tells them nothing; past `reach` even
    // the machine does not know. Between the two is the only place an early warning
    // exists, and it has to be wide enough to live in.
    const reach = c.body.gpu * 4.5 * (1 - 0.5 * w.dustAt(c))
    let best = null, bestD = reach
    for (const t of w.threats) {
      if (!isHostile(t)) continue
      const dp = dist(p, t)
      if (dp < MARK_OBVIOUS) continue   // already on screen and your own problem
      const dc = dist(c, t)
      if (dc < bestD) { bestD = dc; best = t }
    }
    c.marked = best ? { x: best.x, y: best.y } : null
  }
  // face what it noticed; otherwise face where it is going
  const fx = c.marked ? c.marked.x - c.x : (d > 4 ? tx - c.x : p.x - c.x)
  const fy = c.marked ? c.marked.y - c.y : (d > 4 ? ty - c.y : p.y - c.y)
  if (fx || fy) {
    const want = Math.atan2(fy, fx)
    // turn toward it rather than snapping, so the head movement itself reads
    let diff = ((want - c.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    c.facing += diff * Math.min(1, dt * 7)
  }

  // battery: sustained activity drains, standing near the player recovers.
  // ⚠ scaled by CAPACITY, which was a declared organ that nothing read. a bigger battery
  // drains slower and recovers faster, so "it fights well and then stops fighting"
  // (IND-34i) becomes a property of what you built rather than a constant.
  const busy = c.behaviour === 'engage' || c.behaviour === 'cover' || c.behaviour === 'flee'
  const cap = Math.max(0.35, c.body.battery)
  c.charge = clamp(c.charge + (busy ? -dt * 0.10 / cap : dt * 0.16 * cap), 0, 1)

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
  // ⚠ it does not charge machines that gave up. it is brave, not confused.
  const th = w.threats.filter(t => isHostile(t) && dist(h, t) < 230)
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

/**
 * IND-34a §3 history: "you have repaired it when it was damaged, rather than only when
 * it was convenient."
 *
 * ⚠ That distinction has to be MEASURED or the third condition of interposition is
 * decorative. Kneeling next to a hurt machine while nothing is happening is worth very
 * little. Doing it with something closing on you is worth a great deal, and the system
 * can tell the difference without ever mentioning it.
 */
/**
 * 🚨 EVERY source of player damage goes through here, so the interposition cannot be
 * true on one path and silently absent on another.
 *
 * ⚠ There are three of them (a runner's strike, a warden's strike, a caster's shot) and
 * this codebase has already shipped two bugs this session from exactly that shape:
 * perception written twice, and site-reset written twice. One door.
 */
function hurtPlayer(w: World, dmg: number, stop: number) {
  if (w.tryInterpose(dmg)) return
  const p = w.player
  p.hp -= dmg
  p.lastHurt = w.t
  sfx.hurt()
  hitstop(stop)
}

function mend(w: World, dt: number, holding: boolean) {
  const c = w.companion, p = w.player
  if (!c || !holding || dist(c, p) > 42 || c.hp >= c.maxHp) { w.mending = 0; return }

  w.mending += dt
  c.hp = Math.min(c.maxHp, c.hp + dt * 16)

  const hurt = 1 - c.hp / c.maxHp
  // ⚠ repairing next to a machine that gave up is not brave, it is quiet.
  const danger = w.threats.some(t => isHostile(t) && dist(t, p) < 220) ? 2.6 : 1
  c.careShown += dt * 0.30 * (0.35 + hurt) * danger

  if (c.hp >= c.maxHp && w.mending > 0.2) {
    w.log(`${c.name || 'it'} is whole again.`)
    w.mending = 0
  }
}

export function simulate(
  w: World, dt: number, mv: { x: number; y: number }, firing: boolean,
  aim: { x: number; y: number }, recalling = false, mending = false,
) {
  w.t += dt
  const p = w.player

  // ⚠ handled FIRST, before movement, threats or anything else can intervene.
  // The recall is instant or it is not a recall.
  if (recalling) w.recall()
  w.recallFlash = Math.max(0, w.recallFlash - dt * 2.2)
  w.deathFlash = Math.max(0, w.deathFlash - dt * 0.42)   // slow. it should sit on you.

  // ── player ──
  p.prevX = p.x; p.prevY = p.y
  p.x = clamp(p.x + mv.x * 2.5, 12, W - 12)
  p.y = clamp(p.y + mv.y * 2.5, 12, H - 12)

  // 🚨 ARE YOU FALLING BACK?
  //
  // This line used to read `p.retreating = false` and nothing anywhere ever set it
  // true. `s.cover` is gated entirely on it, so COVERING ... "when you retreat, a brave
  // companion advances", which `IND-34c` calls **the entire emotional engine of this
  // game** ... scored zero on every frame since the first commit and has never once
  // fired. The retreat ring in drawPlayer never drew either.
  //
  // ⚠ It is inferred, never a button: you are retreating if you are moving AWAY from
  // something close enough to matter. The scorer already sees your movement, exactly as
  // 34c says it should, and no special case is needed anywhere else.
  {
    // ⚠ single pass, no allocation. This ran filter().sort() on every one of 60 frames
    // a second to find ONE minimum, which is a new array and an O(n log n) for a value
    // that O(n) and no garbage produces.
    let nearT: Threat | undefined, nearD = Infinity
    for (const t of w.threats) {
      if (!isHostile(t)) continue
      const d = dist(p, t)
      if (d < nearD) { nearD = d; nearT = t }
    }
    const moving = mv.x !== 0 || mv.y !== 0
    if (nearT && moving && nearD < 330) {
      // dot product of movement against the direction away from the threat
      const ax = p.x - nearT.x, ay = p.y - nearT.y
      const m = nearD || 1
      p.retreating = (mv.x * ax + mv.y * ay) / m > 0.35
    } else p.retreating = false
  }

  // IND-34j: heat, not ammo. sustained fire locks the weapon for ~2s.
  p.fireCd = Math.max(0, p.fireCd - dt)
  p.overheated = Math.max(0, p.overheated - dt)
  // ⚠ IND-34j: "a rhythm mechanic, not a resource chore ... two seconds, generous
  // threshold, and it should feel like restraint rather than like maths."
  //
  // It was neither, because the cooling branch ran on every frame BETWEEN shots while
  // the trigger was still held. Net climb was 0.27/s, so the lock needed ~3.7 seconds
  // of unbroken fire and two separate probe runs at 2.6s never once tripped it. The
  // bar was decorative. Holding the trigger no longer cools the driver, which puts the
  // lock at ~1.9s and makes trigger discipline an actual decision.
  if (firing && p.overheated <= 0) {
    if (p.fireCd <= 0) {
      const a = Math.atan2(aim.y - p.y, aim.x - p.x)
      w.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 1.1, from: 'player' })
      p.fireCd = 0.14
      p.heat = Math.min(1, p.heat + 0.075)
      sfx.fire()
      if (p.heat >= 1) { p.overheated = 2; p.heat = 1; sfx.overheat(); w.log('the driver is too hot to fire.') }
    }
  } else {
    // ⚠ Cooling must roughly MATCH heating, or "trigger discipline" becomes a ratio the
    // player has to compute. At 0.30/s against a 0.535/s climb you had to rest nearly
    // twice as long as you fired, and ten bursts of 0.9s-on / 0.7s-off still locked.
    // At 0.70/s a burst costs about as long as it lasts, which is a rhythm you feel
    // rather than solve.
    p.heat = Math.max(0, p.heat - dt * (p.overheated > 0 ? 0.85 : 0.70))
  }

  // ── bullets ──
  for (let i = w.bullets.length - 1; i >= 0; i--) {
    const b = w.bullets[i]
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > W || b.y > H) { w.bullets.splice(i, 1); continue }

    // IND-34n: incoming fire. It hits the player and the companion and nothing else,
    // so a caster is a threat to dodge rather than a threat to out-position.
    if (b.from === 'threat') {
      if (dist(b, p) < p.r + 5) {
        w.bullets.splice(i, 1)
        hurtPlayer(w, casterDamage(depthAt(p.x)), 50)
        continue
      }
      if (w.companion && dist(b, w.companion) < w.companion.r + 5) {
        w.companion.hp -= casterDamage(depthAt(p.x))
        w.bullets.splice(i, 1); sfx.hurt(); continue
      }
      continue
    }

    for (const t of w.threats) {
      if (!t.alive || Math.hypot(b.x - t.x, b.y - t.y) > t.r + 3) continue
      t.hp -= 12
      w.bullets.splice(i, 1)
      hitstop(t.hp <= 0 ? 90 : 40)      // game-feel: hitstop before particles
      sfx.hit()

      // 🚨 IND-34l: every one of them is salvage, and the game will never stop you.
      // The ones that gave up INTACT are BETTER salvage ... whole, undamaged, not torn
      // out of anything still running. So the most upsetting thing in any given room is
      // usually also the most profitable. ⚠ The game does not comment. No morality
      // anywhere, no reward for kindness, no penalty for stripping.
      if (t.kind === 'stopped' && t.hp <= 0) {
        t.alive = false
        w.salvage.push({ x: t.x - 9, y: t.y, frag: pickFrag() })
        w.salvage.push({ x: t.x + 9, y: t.y + 6, frag: pickFrag() })
        sfx.destroy()
      }
      break
    }
  }

  // ── threats. they telegraph enormously, because they were built to be safe
  //    around humans and that safety system is one of the few things still working. ──
  for (const t of w.threats) {
    if (!t.alive) continue

    // ⚠ IND-34l: the ones that gave up do not react to you. Not to light, not to noise,
    // not to being taken apart. They are skipped before ANY behaviour runs, because a
    // stopped machine that flinches is a machine that noticed, and the moment one
    // notices the whole register collapses into pathos.
    if (t.kind === 'stopped') continue

    const warden = t.kind === 'warden'

    // IND-34k step 5: it announces itself. Politely, because announcing was part of
    // the procedure. ⚠ No threat, no menace, no villain voice. It is doing its job.
    if (warden && !t.announced && dist(t, p) < 620) {
      t.announced = true
      sfx.announce()
      w.log(t.degree === 2 ? 'UNIT 12. AREA IS BEING CLEARED. PLEASE STAND AWAY.'
                           : 'UNIT 7. AREA IS BEING CLEARED. PLEASE STAND AWAY.')
    }

    // 🚨 IND-34l degree 2: it announced, and it cannot follow through. Its targeting is
    // gone. It will give the warning again every time you pass, for as long as the game
    // exists, and it will never do anything else.
    //
    // ⚠ The two seconds where you cannot tell whether it is broken or you are simply
    // not in range yet is free tension and the best thing about the whole system. It
    // gets NO label, NO colour and NO health bar ... degree is readable from behaviour
    // or it is not readable at all.
    if (warden && t.degree === 2) {
      t.wind = 0; t.striking = false
      if (dist(t, p) > 780 && w.t > (t.rearmAt ?? 0)) { t.announced = false; t.rearmAt = w.t + 8 }
      continue
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

    // ⚠ IND-34i: "task-runners in a dust storm cannot see you either. Weather is COVER
    // as often as it is a threat." A hazard that only ever costs the player is a tax;
    // one that also blinds what is hunting them is a decision.
    const blind = w.dustAt(t)
    if (blind > 0.15 && d > 210 * (1 - blind * 0.7)) {
      t.wind = Math.max(0, t.wind - dt * 2); t.striking = false
      // it wanders, because it has lost you rather than because it is idle
      t.x += Math.cos(t.seed + w.t * 0.4) * t.speed * 0.5
      t.y += Math.sin(t.seed + w.t * 0.4) * t.speed * 0.5
      continue
    }

    // ── IND-34n: the caster. It keeps its distance and shoots, so the fight has a
    //    second verb. A field of pure melee can only ever be walked away from.
    if (t.kind === 'caster') {
      const HOLD = 300                     // outranges the player's ~230px comfortable
      t.fireCd = Math.max(0, (t.fireCd ?? 0) - dt)
      if (d > HOLD + 30) { t.x += (tgt.x - t.x) / d * t.speed; t.y += (tgt.y - t.y) / d * t.speed }
      else if (d < HOLD - 60) { t.x -= (tgt.x - t.x) / d * t.speed; t.y -= (tgt.y - t.y) / d * t.speed }
      // the wind-up IS the telegraph, same law as everything else here.
      if (d < HOLD + 90) t.wind = Math.min(1, t.wind + dt * 1.5)
      else t.wind = Math.max(0, t.wind - dt * 2)
      if (t.wind >= 1 && (t.fireCd ?? 0) <= 0) {
        t.wind = 0; t.fireCd = 1.9 + Math.random() * 0.9
        const a = Math.atan2(tgt.y - t.y, tgt.x - t.x)
        // ⚠ SLOW. A shot you cannot sidestep is unavoidable damage wearing a costume,
        // and 34c law 1 says no such thing exists anywhere in this game.
        w.bullets.push({ x: t.x, y: t.y, vx: Math.cos(a) * 168, vy: Math.sin(a) * 168,
                         life: 2.6, from: 'threat' })
        sfx.fire()
      }
      if (t.hp <= 0) {
        t.alive = false
        w.salvage.push({ x: t.x, y: t.y, frag: Math.random() < 0.30 ? pickFrag() : null })
        sfx.destroy()
      }
      continue
    }

    const reach = warden ? 92 : 56
    if (d < reach) { t.wind += dt; t.striking = t.wind > (warden ? 0.85 : 0.55) }
    else { t.wind = Math.max(0, t.wind - dt * 2); t.striking = false
           t.x += (tgt.x - t.x) / d * t.speed; t.y += (tgt.y - t.y) / d * t.speed }
    if (t.striking && t.wind > (warden ? 1.5 : 0.95)) {
      t.wind = 0
      const hitR = warden ? 96 : 58
      if (dist(t, tgt) < hitR) {
        // ⚠ The warden keeps its teeth. IND-34n is explicit that the fix is a gentler
        // OPENING, not a nerfed exception ... the whole of 34k rests on it being the
        // thing you leave rather than the thing you beat.
        const dmg = warden ? 30 : runnerDamage(depthAt(p.x))
        if (tgt === p) hurtPlayer(w, dmg, warden ? 120 : 70)
        else if (tgt === w.handler) w.killHandler()
        else if (w.companion) { w.companion.hp -= warden ? 34 : dmg; sfx.hurt() }
      }
    }

    // 🚨 the permanent rule, enforced regardless of what the warden was aiming at.
    // a handler that is anywhere near a swinging warden dies. always. everywhere.
    if (warden && w.handler?.alive && dist(t, w.handler) < 78) w.killHandler()

    if (t.hp <= 0) {
      t.alive = false
      // ⚠ IND-34i: "better salvage under bad weather. The reason to go in anyway, and
      // the whole risk economy in one line."
      const odds = 0.22 + w.dustAt(t) * 0.34
      w.salvage.push({ x: t.x, y: t.y, frag: warden ? 'selfpres' : Math.random() < odds ? pickFrag() : null })
      sfx.destroy()
      // ⚠ and when it stops, nothing is said. no text, no reward screen, no
      // acknowledgement of what the player just carried into that room.
      if (warden) hitstop(220)
    }
  }
  w.threats = w.threats.filter(t => t.alive || dist(t, p) < 900)

  // ⚠ IND-34n: the CROWD is what kills, and a crowd is not a pattern. Seven simultaneous
  // melee bodies means damage arrives as an unavoidable swarm, which satisfies "everything
  // is dodgeable" on paper and breaks it in spirit. Fewer bodies, more depth-scaled.
  w.spawnTimer -= dt
  const d = depthAt(p.x)
  const cap = Math.round(3 + d * 3)                  // 3 in the shallows, 6 at the edge
  // ⚠ the stopped ones are furniture, not pressure. counting them toward the crowd cap
  // would mean walking past a machine that gave up makes the field SAFER.
  const hostile = w.threats.filter(t => t.alive && t.kind !== 'stopped').length
  if (w.spawnTimer <= 0 && hostile < cap) {
    w.spawnThreat(); w.spawnTimer = (4.4 - d * 1.4) + Math.random() * 3
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

  // IND-34c: going back for it. No prompt, no marker, no objective ... you walk to the
  // place where you died and it is there.
  if (w.waiting && dist(p, w.waiting) < 24) w.retrieve()

  // how far east you got this run. the only "score" that is not a number of things.
  w.deepest = Math.max(w.deepest, p.x)

  // ── IND-34k, the beat. Assembled from two permanent rules, introduced once. ──
  //
  // step 1: the handler finds you. after the companion is standing, so the player
  // already knows what a machine of their own feels like.
  if (!w.handlerMet && w.chassis?.taken && w.t > 40) w.spawnHandler()
  if (w.handler?.alive) actHandler(w.handler, w, dt)

  // step 4: you keep going. everyone keeps going.
  // ⚠ the warden is placed, and that is admitted. what must be real is the RULE, and
  // the rule holds for the rest of the game.
  //
  // 🚨 Measured 2026-08-06 in three minutes of ordinary play: the handler arrived at
  // t=40.4s and the warden spawned at t=40.4s. **Zero seconds of company.** The player
  // had already wandered east, so the position gate was satisfied the instant the dog
  // existed, and IND-34k's central warning ... "if it is only there to die, players will
  // feel handled" ... was true in its most extreme possible form.
  //
  // Going deep is no longer sufficient. The dog has to have BEEN there.
  if (!w.wardenSpawned && w.handler?.alive && p.x > DEEP_X
      && w.t - w.handlerMetAt > HANDLER_GRACE) w.spawnWarden()

  // IND-34a §3: the history that interposition reads.
  mend(w, dt, mending)

  // ── IND-34i: the weather crosses ──
  if (w.weather) {
    const x = w.weather
    x.age += dt
    x.x += x.vx * dt; x.y += x.vy * dt
    // it arrives and it leaves. never a wall of effect that snaps on.
    x.strength = Math.min(1, Math.min(x.age / 9, (x.life - x.age) / 12))
    if (x.age > x.life || x.x < -700 || x.x > W + 700) {
      w.weather = null
      w.weatherTimer = 70 + Math.random() * 60
      w.log('the air clears.')
    }
  } else {
    w.weatherTimer -= dt
    if (w.weatherTimer <= 0) w.spawnWeather()
  }

  // ── the companion ──
  if (w.companion) {
    const c = w.companion
    decide(c, w, dt)
    act(c, w, dt)
    // 🚨 THE GATE'S OTHER HALF: "seven name the companion unprompted AND REACT WHEN IT
    // IS BADLY HURT." A player cannot react to something they never notice.
    //
    // ⚠ Measured: three minutes of ordinary play drove it down to 43% of its health and
    // the game said NOTHING, because the only line lived behind `hp <= 0`. The single
    // most important signal in the build fired exclusively at the floor.
    //
    // It speaks once when it crosses into real trouble, and it does not speak again
    // until it has been made whole ... so the line stays rare enough to mean something.
    // ⚠ HALF, not 40%. Measured across ordinary play: the companion bottoms out around
    // 43% of its health, so a threshold at 0.4 meant the single most important signal in
    // the build almost never fired ... it was tuned to a number just below where the game
    // actually goes. More than half its health gone IS badly hurt, and the gate asks
    // whether players react to exactly that.
    const frac = c.hp / c.maxHp
    if (frac < 0.5 && !c.hurtAnnounced) {
      c.hurtAnnounced = true
      w.log(`${c.name || 'it'} is hurt.`)
    }
    if (frac > 0.85) c.hurtAnnounced = false
    if (c.hp <= 0) { c.hp = 1; c.hurtAnnounced = true; w.log(`${c.name || 'it'} is badly damaged.`) }

    // ⚠ You earn it back, and it is quicker than the first time and it is not free.
    // Time spent near it, not fleeing, with nothing chasing you. About three minutes
    // of ordinary company from 0.4 back to whole, which is short enough not to be a
    // grind and long enough that the loss is a thing you actually live through.
    if (c.bond < 1) {
      const calm = c.behaviour !== 'flee' && dist(c, p) < 120
      if (calm) {
        const before = c.bond
        c.bond = Math.min(1, c.bond + dt * 0.0034)
        if (before < 1 && c.bond >= 1) w.log(`${c.name || 'it'} stays close again.`)
        c.recompute()
      }
    }
  }

  if (p.hp <= 0) w.die()
}

const FRAG_POOL = ['attend', 'repair', 'salvage', 'ward', 'prudence', 'pursuit', 'inquiry', 'brace', 'selfpres', 'mark']
const pickFrag = () => FRAG_POOL[Math.floor(Math.random() * FRAG_POOL.length)]
