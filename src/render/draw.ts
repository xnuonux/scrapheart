// Rendering. One camera, one light, silhouettes.
// IND-34m: light does most of the work. Cheapest atmosphere available in 2D.

import { P, hex } from './palette'
import { drawWreck, drawMachine, drawCompanion, drawPlayer, drawHandler, drawWarden, drawCaster } from './sprites'
import type { World } from '../game/world'
import { W as WORLD_W, H as WORLD_H } from '../game/world'

export const cam = { x: 0, y: 0, shake: 0 }

/**
 * game-perf: the dust body, rasterised once and reused.
 *
 * ⚠ Keyed on radius and capped, because a cache with an unbounded key set is a memory
 * leak wearing an optimisation's clothes. The weather radius is 300-490, so quantising
 * to 32px gives at most a handful of entries for the life of the process.
 */
/** how many drifting bands the dust draws on top of its body. see the call site. */
const DUST_BANDS = (typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches) ? 1 : 5

/**
 * 🚨 EVERY radial glow in this game, rasterised once and blitted after.
 *
 * Instrumented count before this existed: **16 createRadialGradient calls per frame in
 * CLEAR AIR** ... lamps, fragment glows, the anchor, the waiting companion, every enemy
 * bullet. Gradients are the most expensive call in the canvas 2D API and the game was
 * rebuilding sixteen identical ones sixty times a second.
 *
 * ⚠ I cached the dust and thought that was the fill-rate problem. The dust was the one
 * I could SEE. The ordinary background glow of the world cost more, all the time, and
 * only showed up when I counted the calls instead of watching the frame rate.
 *
 * Keyed on colour + quantised radius, so the key set is tiny and bounded.
 */
const glowCache = new Map<string, HTMLCanvasElement>()
function glowSprite(colour: string, radius: number, inner = 0, mid?: [number, number]): HTMLCanvasElement {
  const r = Math.max(8, Math.round(radius / 8) * 8)
  const key = `${colour}|${r}|${inner}|${mid?.[0] ?? ''}|${mid?.[1] ?? ''}`
  const hit = glowCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = r * 2
  const g2 = c.getContext('2d')!
  const g = g2.createRadialGradient(r, r, r * inner, r, r, r)
  g.addColorStop(0, hex(colour, 1))
  if (mid) g.addColorStop(mid[0], hex(colour, mid[1]))
  g.addColorStop(1, hex(colour, 0))
  g2.fillStyle = g
  g2.fillRect(0, 0, r * 2, r * 2)
  glowCache.set(key, c)
  return c
}

/** blit a cached glow centred at (x,y) with an overall alpha. */
function glow(cx: CanvasRenderingContext2D, colour: string, x: number, y: number,
              radius: number, alpha: number, inner = 0, mid?: [number, number]) {
  if (alpha <= 0.004 || radius <= 0) return
  const s = glowSprite(colour, radius, inner, mid)
  cx.globalAlpha = alpha
  cx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2)
  cx.globalAlpha = 1
}

/**
 * The vignette. Full-screen, so it is the biggest fill in the frame, and it was rebuilt
 * as a fresh gradient every single one.
 * ⚠ Rendered at quarter resolution and stretched: a smooth radial falloff has no detail
 * to lose, and it cuts the rasterisation cost 16x. Cached per viewport + dust step.
 */
const vignetteCache = new Map<string, HTMLCanvasElement>()
function vignette(vw: number, vh: number, dust: number): HTMLCanvasElement {
  const key = `${vw}x${vh}|${dust}`
  const hit = vignetteCache.get(key)
  if (hit) return hit
  if (vignetteCache.size > 24) vignetteCache.clear()   // viewport resizes must not leak
  const s = 4
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(vw / s)); c.height = Math.max(1, Math.ceil(vh / s))
  const g2 = c.getContext('2d')!
  const inner = Math.min(c.width, c.height) * (0.30 - dust * 0.22)
  const outer = Math.max(c.width, c.height) * (0.72 - dust * 0.30)
  const vg = g2.createRadialGradient(c.width / 2, c.height / 2, Math.max(0, inner),
                                     c.width / 2, c.height / 2, Math.max(1, outer))
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.78)')
  g2.fillStyle = vg; g2.fillRect(0, 0, c.width, c.height)
  vignetteCache.set(key, c)
  return c
}

const dustSprite = (radius: number) =>
  glowSprite(P.dust, Math.max(64, Math.round(radius / 32) * 32), 0.18, [0.55, 0.60])

/** trauma-based shake, squared and decaying. never additive. game-vfx. */
export function addTrauma(a: number) { cam.shake = Math.min(1, cam.shake + a) }

export function updateCamera(w: World, dt: number) {
  // lead the movement ~15% of the screen, lerp framerate-independently
  const tx = w.player.x, ty = w.player.y
  const k = 1 - Math.pow(0.0015, dt)
  cam.x += (tx - cam.x) * k
  cam.y += (ty - cam.y) * k
  cam.shake = Math.max(0, cam.shake - dt * 1.8)
}

export function render(cx: CanvasRenderingContext2D, w: World, alpha: number, vw: number, vh: number) {
  const s = cam.shake * cam.shake
  const ox = vw / 2 - cam.x + (Math.random() * 2 - 1) * 16 * s
  const oy = vh / 2 - cam.y + (Math.random() * 2 - 1) * 16 * s

  cx.fillStyle = P.void
  cx.fillRect(0, 0, vw, vh)
  cx.save()
  cx.translate(ox, oy)

  // ground: three flat bands, no texture. cold and dry.
  cx.fillStyle = P.ground0
  cx.fillRect(0, 0, WORLD_W, WORLD_H)
  cx.fillStyle = hex(P.ground1, 0.5)
  for (let gx = 0; gx < WORLD_W; gx += 160)
    for (let gy = 0; gy < WORLD_H; gy += 160)
      if (((gx / 160) + (gy / 160)) % 2 === 0) cx.fillRect(gx, gy, 160, 160)

  // a faint grid: structure, not decoration. it makes distance readable.
  cx.strokeStyle = hex(P.structure, 0.30); cx.lineWidth = 1
  for (let gx = 0; gx <= WORLD_W; gx += 80) { cx.beginPath(); cx.moveTo(gx, 0); cx.lineTo(gx, WORLD_H); cx.stroke() }
  for (let gy = 0; gy <= WORLD_H; gy += 80) { cx.beginPath(); cx.moveTo(0, gy); cx.lineTo(WORLD_W, gy); cx.stroke() }

  // the field of stopped machines
  const vx0 = cam.x - vw / 2 - 60, vx1 = cam.x + vw / 2 + 60
  const vy0 = cam.y - vh / 2 - 60, vy1 = cam.y + vh / 2 + 60
  for (const wr of w.wrecks) {
    if (wr.x < vx0 || wr.x > vx1 || wr.y < vy0 || wr.y > vy1) continue
    drawWreck(cx, wr.x, wr.y, wr.s, wr.seed, wr.seed % 17 === 0)
  }

  // things worth nothing (IND-34m). they are only ever a shape and a light.
  for (const i of w.interest) {
    if (i.x < vx0 || i.x > vx1 || i.y < vy0 || i.y > vy1) continue
    const t = performance.now() / 1000
    // ⚠ IND-34k's heart also sits in this list so the companion's curiosity can find
    // it. It must NOT draw an ambient lamp on top of itself: the field already has
    // nine identical amber blobs and the first glowing fragment the player ever sees
    // was landing as the tenth. The salvage pass owns its look entirely.
    if ((i.pull ?? 1) > 1) continue
    if (i.kind === 'lamp') {
      glow(cx, P.lamp, i.x, i.y, 90, 0.22)
      cx.fillStyle = hex(P.lamp, 0.85); cx.fillRect(i.x - 1, i.y - 6, 2, 6)
    } else if (i.kind === 'arrangement') {
      // evidence that someone made a small choice about comfort
      cx.fillStyle = hex(P.edge, 0.9)
      cx.fillRect(i.x - 10, i.y - 3, 8, 6); cx.fillRect(i.x + 3, i.y - 5, 7, 9)
      cx.fillRect(i.x - 14, i.y + 6, 28, 2)
    } else {
      cx.strokeStyle = hex(P.edge, 0.55 + Math.sin(t + i.x) * 0.08); cx.lineWidth = 2
      cx.beginPath(); cx.moveTo(i.x - 26, i.y + 10); cx.lineTo(i.x, i.y - 14); cx.lineTo(i.x + 26, i.y + 10); cx.stroke()
    }
    if (i.seen) { cx.fillStyle = hex(P.comp, 0.35); cx.fillRect(i.x - 2, i.y + 14, 4, 1) }
  }

  // salvage
  for (const sv of w.salvage) {
    if (sv.x < vx0 || sv.x > vx1) continue
    cx.fillStyle = (sv.worn ?? 0) > 0 ? P.playerHi : sv.frag ? P.glow : P.salvage
    cx.fillRect(sv.x - 3, sv.y - 3, 6, 6)
    if (sv.frag) {
      // IND-34i: a fragment that a mind lived in has not fully stopped.
      //
      // ⚠ IND-34k: a WORN one lived in for an entire existence, and this is the first
      // one the player ever sees. It has to be unmistakably not-like-the-others at a
      // glance, from across a field, without a word ... so it breathes.
      const w0 = sv.worn ?? 0
      if (w0 <= 0) {
        glow(cx, P.glow, sv.x, sv.y, 26, 0.30)
      } else {
        // ⚠ The worn one has to separate from a field of nine amber lamps and a dozen
        // amber salvage glows, or "the first glowing fragment the player ever sees"
        // reads as the tenth lamp. So it is the one thing in the game that is WHITE,
        // and it breathes, and nothing else does either.
        const beat = 0.5 + Math.sin(performance.now() / 900) * 0.5
        const rad = 34 + 26 * beat
        // ⚠ the breathing lives in the RADIUS and the blit alpha, so the texture itself
        // stays constant and cacheable. quantised radius means a handful of sprites.
        glow(cx, P.playerHi, sv.x, sv.y, rad, 0.22 + 0.20 * beat, 0, [0.45, 0.7])
        cx.fillStyle = hex(P.playerHi, 0.75 + 0.25 * beat)
        cx.fillRect(sv.x - 2.5, sv.y - 2.5, 5, 5)
      }
    }
  }

  // the chassis, before it is anything
  if (w.chassis && !w.chassis.taken) {
    cx.fillStyle = hex(P.compDim, 0.85)
    cx.fillRect(w.chassis.x - 6, w.chassis.y - 6, 12, 12)
    cx.strokeStyle = hex(P.comp, 0.30); cx.lineWidth = 1
    cx.strokeRect(w.chassis.x - 11, w.chassis.y - 11, 22, 22)
  }

  for (const t of w.threats) {
    if (!t.alive) continue
    // IND-34l: it is ON, and it is doing nothing. ⚠ Drawn with the wreck routine
    // because it IS a wreck in silhouette ... the only thing separating it from the ten
    // thousand around it is that one light is still lit. No label, no colour, no bar.
    if (t.kind === 'stopped') { drawWreck(cx, t.x, t.y, t.r * 1.5, t.seed, true); continue }
    if (t.kind === 'warden') drawWarden(cx, t.x, t.y, t.r, t.wind)
    else if (t.kind === 'caster') drawCaster(cx, t.x, t.y, t.r, t.seed, t.wind)
    else drawMachine(cx, t.x, t.y, t.r, t.seed, t.wind)
    if (t.hp < t.maxHp) {
      const bw = t.kind === 'warden' ? 44 : 22
      cx.fillStyle = hex(P.harmDim, 0.9); cx.fillRect(t.x - bw / 2, t.y - t.r - 12, bw, 2)
      // ⚠ clamped: a negative hp drew the bar BACKWARDS, a red line reaching across the
      // field. the damage door now kills at zero, and the renderer refuses to lie anyway.
      cx.fillStyle = P.harm; cx.fillRect(t.x - bw / 2, t.y - t.r - 12, bw * Math.max(0, t.hp / t.maxHp), 2)
    }
  }

  if (w.handler?.alive) {
    const h = w.handler
    drawHandler(cx, h.prevX + (h.x - h.prevX) * alpha, h.prevY + (h.y - h.prevY) * alpha, h.bob)
  }

  // THE ANCHOR (IND-34c). Where the recall puts you. Warm, so it reads as the one
  // safe thing in a cold field without a single word of tutorial. It has to be
  // VISIBLE or "home" is just a coordinate the player never learns.
  {
    const a = w.anchor
    const breathe = 0.5 + Math.sin(w.t * 0.9) * 0.12
    glow(cx, P.lamp, a.x, a.y, 70, 0.14 * breathe)
    cx.strokeStyle = hex(P.lamp, 0.34); cx.lineWidth = 1
    cx.beginPath(); cx.arc(a.x, a.y, 26, 0, Math.PI * 2); cx.stroke()
    cx.fillStyle = hex(P.lamp, 0.7)
    for (let i = 0; i < 4; i++) {
      const th = i * Math.PI / 2 + Math.PI / 4
      cx.fillRect(a.x + Math.cos(th) * 26 - 1, a.y + Math.sin(th) * 26 - 1, 2, 2)
    }
  }

  // ⚠ Incoming fire must never be mistaken for your own. Harm is the only saturated
  // colour in the palette and this is the one place it moves.
  for (const b of w.bullets) {
    if (b.from === 'threat') {
      // ⚠ one gradient PER BULLET per frame, previously. a caster volley multiplied it.
      glow(cx, P.harm, b.x, b.y, 11, 0.5)
      cx.fillStyle = P.harm; cx.fillRect(b.x - 2.5, b.y - 2.5, 5, 5)
    } else {
      cx.fillStyle = P.lamp; cx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3)
    }
  }

  // IND-34c: it stays where you fell. It waits. And it is VISIBLE in the world ...
  // ⚠ if a player cannot see it from a distance, "go back for it" is a treasure hunt
  // for a thing you did not know you still had.
  if (w.waiting) {
    const q = w.waiting
    const pulse = 0.35 + Math.sin(performance.now() / 1400) * 0.25
    glow(cx, P.comp, q.x, q.y, 86, 0.13 * (1 + pulse))
    // dimmer than a live companion, and it does not move at all.
    cx.fillStyle = hex(P.compDim, 0.95)
    cx.fillRect(q.x - 5, q.y - 5, 10, 10)
    cx.fillStyle = hex(P.comp, 0.55)
    for (let i = 0; i < q.c.liveFragments.length; i++) cx.fillRect(q.x - 5 + i * 4, q.y + 6, 3, 2)
    cx.fillStyle = hex(P.glow, 0.4 + pulse)     // the light is still on
    cx.fillRect(q.x - 1, q.y - 2, 2, 2)
  }

  if (w.companion) {
    const c = w.companion
    const px = c.prevX + (c.x - c.prevX) * alpha
    const py = c.prevY + (c.y - c.prevY) * alpha
    // ⚠ `hurt` was hardcoded to 0, so the damage state the whole gate depends on was
    // never once drawn. It is 0..1 of how far down it is.
    drawCompanion(cx, px, py, c.liveFragments.length, c.exposure, 1 - c.hp / c.maxHp,
                  c.emptySockets, w.mending > 0, c.facing, !!c.marked)
  }

  const p = w.player
  drawPlayer(cx, p.prevX + (p.x - p.prevX) * alpha, p.prevY + (p.y - p.prevY) * alpha,
             w.t - p.lastHurt < 0.12, p.retreating)

  // 🚨 IND-34i: THE DUST. Drawn over the world but INSIDE the camera transform, so it
  // sits in the field and can be seen coming from the far side of the map. That
  // visibility is the one rule the doc says cannot be compromised for drama ... weather
  // you cannot see approaching is a random punishment, and `34c`'s law is that nothing
  // kills you but greed.
  if (w.weather) {
    const x = w.weather, s = x.strength
    // ⚠ ONE cached sprite, blitted. This built six radial gradients EVERY FRAME and
    // measured 55-57fps against a flat 60 everywhere else, on a desktop, for a game
    // whose target is a mid-range Android. Gradients are the most expensive call in
    // canvas 2D and rebuilding an identical one 360 times a second is pure waste.
    // ⚠ x0.5 because the shared sprite bakes full alpha and the old inline gradient
    // peaked at 0.50. The opacity now lives at the blit, not in the texture.
    const body = dustSprite(Math.round(x.r))
    cx.globalAlpha = s * 0.5
    cx.drawImage(body, x.x - x.r, x.y - x.r, x.r * 2, x.r * 2)
    // a few drifting bands so it reads as moving air rather than a painted circle.
    // same sprite, different sizes and offsets ... no new gradients.
    //
    // 🚨 FILL RATE, not gradient construction, is what dust actually costs. Profiled on
    // a throttled Pixel 5 it took **19fps** even after the sprite cache, because six
    // huge translucent blits is six full passes over most of the screen. The cache fixed
    // the wrong half of the problem.
    // ⚠ Mobile gets one band. game-perf: a quality tier the player never notices beats a
    // frame rate they do.
    for (let i = 0; i < DUST_BANDS; i++) {
      const ph = w.t * (0.25 + i * 0.05) + i * 1.7
      const bx = x.x + Math.cos(ph) * x.r * 0.5
      const by = x.y + Math.sin(ph * 0.7) * x.r * 0.34
      const br = x.r * (0.30 + (i % 3) * 0.09)
      cx.globalAlpha = s * 0.34
      cx.drawImage(body, bx - br, by - br, br * 2, br * 2)
    }
    cx.globalAlpha = 1
  }

  // ⚠ The world stops at W and H, and past DEEP_X the player is always near the east
  // boundary, so a hard black rectangle sat in frame for the entire back half of the
  // game. The ground has to END rather than be CUT ... dust closing in, not a level
  // running out. Drawn inside the camera transform, over everything, at the four edges.
  const FADE = 190
  const band = (x: number, y: number, bw: number, bh: number, x0: number, y0: number, x1: number, y1: number) => {
    const g = cx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, hex(P.void, 0)); g.addColorStop(1, hex(P.void, 0.98))
    cx.fillStyle = g; cx.fillRect(x, y, bw, bh)
  }
  band(WORLD_W - FADE, -400, FADE + 400, WORLD_H + 800, WORLD_W - FADE, 0, WORLD_W, 0)
  band(-400, -400, FADE + 400, WORLD_H + 800, FADE, 0, 0, 0)
  band(-400, WORLD_H - FADE, WORLD_W + 800, FADE + 400, 0, WORLD_H - FADE, 0, WORLD_H)
  band(-400, -400, WORLD_W + 800, FADE + 400, 0, FADE, 0, 0)

  cx.restore()

  // vignette. the dark closes in. ⚠ And in dust it closes in FURTHER, so the player
  // feels the same loss of perception the companion is taking as a stat.
  // ⚠ The last per-frame gradient, and the biggest single fill in the game since it
  // covers the whole screen. Cached on viewport + dust QUANTISED to 8 steps, so it
  // rebuilds only when the storm meaningfully thickens rather than on every frame.
  const dust = w.dustAt(w.player)
  cx.drawImage(vignette(vw, vh, Math.round(dust * 8) / 8), 0, 0, vw, vh)
  if (dust > 0) {
    cx.fillStyle = hex(P.dust, dust * 0.16)
    cx.fillRect(0, 0, vw, vh)
  }

  // IND-34c: the recall. cold, not triumphant. the world goes away for a moment and
  // comes back somewhere quieter. it closes IN rather than flashing out, because
  // leaving is a contraction and the screen should agree with the fiction.
  // IND-34c: you die here. ⚠ No reward screen, no retry button, no score tally
  // thrown in your face. The dark comes in slowly and stays a while, and then you are
  // somewhere else with nothing. Everything the player needs to know is already in
  // the world: the pack is empty and it is standing out there.
  if (w.deathFlash > 0) {
    const f = Math.min(1, w.deathFlash)
    cx.fillStyle = hex(P.void, f * 0.94)
    cx.fillRect(0, 0, vw, vh)
    cx.globalAlpha = Math.min(1, f * 1.6)
    cx.fillStyle = hex(P.player, 0.55)
    cx.font = '12px ui-monospace, monospace'
    cx.textAlign = 'center'
    // ⚠ Placed above centre: the player sprite is ALWAYS at the middle of the screen,
    // so centred text lands on top of them.
    const cy = vh * 0.36
    cx.fillText(`run ${w.run - 1} ended`, vw / 2, cy)
    const r = w.records[0]
    if (r) {
      cx.fillStyle = hex(P.compDim, 0.75)
      cx.fillText(r.kept ? `${r.seconds}s, and the ${r.kept} you kept are gone too`
                         : `${r.seconds}s, and you had nothing to lose`, vw / 2, cy + 20)
    }
    cx.globalAlpha = 1
  }

  if (w.recallFlash > 0) {
    const f = w.recallFlash
    cx.fillStyle = hex(P.void, f * 0.85)
    cx.fillRect(0, 0, vw, vh)
    const rg = cx.createRadialGradient(vw / 2, vh / 2, 0, vw / 2, vh / 2, Math.max(vw, vh) * 0.5 * (1 - f * 0.7))
    rg.addColorStop(0, hex(P.comp, f * 0.16)); rg.addColorStop(1, hex(P.comp, 0))
    cx.fillStyle = rg; cx.fillRect(0, 0, vw, vh)
  }
}
