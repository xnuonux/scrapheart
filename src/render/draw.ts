// Rendering. One camera, one light, silhouettes.
// IND-34m: light does most of the work. Cheapest atmosphere available in 2D.

import { P, hex } from './palette'
import { drawWreck, drawMachine, drawCompanion, drawPlayer } from './sprites'
import type { World } from '../game/world'
import { W as WORLD_W, H as WORLD_H } from '../game/world'

export const cam = { x: 0, y: 0, shake: 0 }

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
    if (i.kind === 'lamp') {
      const g = cx.createRadialGradient(i.x, i.y, 0, i.x, i.y, 90)
      g.addColorStop(0, hex(P.lamp, 0.22)); g.addColorStop(1, hex(P.lamp, 0))
      cx.fillStyle = g; cx.fillRect(i.x - 90, i.y - 90, 180, 180)
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
    cx.fillStyle = sv.frag ? P.glow : P.salvage
    cx.fillRect(sv.x - 3, sv.y - 3, 6, 6)
    if (sv.frag) {
      // IND-34i: a fragment that a mind lived in has not fully stopped.
      const g = cx.createRadialGradient(sv.x, sv.y, 0, sv.x, sv.y, 26)
      g.addColorStop(0, hex(P.glow, 0.30)); g.addColorStop(1, hex(P.glow, 0))
      cx.fillStyle = g; cx.fillRect(sv.x - 26, sv.y - 26, 52, 52)
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
    drawMachine(cx, t.x, t.y, t.r, t.seed, t.wind)
    if (t.hp < t.maxHp) {
      cx.fillStyle = hex(P.harmDim, 0.9); cx.fillRect(t.x - 11, t.y - 19, 22, 2)
      cx.fillStyle = P.harm; cx.fillRect(t.x - 11, t.y - 19, 22 * (t.hp / t.maxHp), 2)
    }
  }

  // THE ANCHOR (IND-34c). Where the recall puts you. Warm, so it reads as the one
  // safe thing in a cold field without a single word of tutorial. It has to be
  // VISIBLE or "home" is just a coordinate the player never learns.
  {
    const a = w.anchor
    const breathe = 0.5 + Math.sin(w.t * 0.9) * 0.12
    const g = cx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 70)
    g.addColorStop(0, hex(P.lamp, 0.14 * breathe)); g.addColorStop(1, hex(P.lamp, 0))
    cx.fillStyle = g; cx.fillRect(a.x - 70, a.y - 70, 140, 140)
    cx.strokeStyle = hex(P.lamp, 0.34); cx.lineWidth = 1
    cx.beginPath(); cx.arc(a.x, a.y, 26, 0, Math.PI * 2); cx.stroke()
    cx.fillStyle = hex(P.lamp, 0.7)
    for (let i = 0; i < 4; i++) {
      const th = i * Math.PI / 2 + Math.PI / 4
      cx.fillRect(a.x + Math.cos(th) * 26 - 1, a.y + Math.sin(th) * 26 - 1, 2, 2)
    }
  }

  cx.fillStyle = P.lamp
  for (const b of w.bullets) cx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3)

  if (w.companion) {
    const c = w.companion
    const px = c.prevX + (c.x - c.prevX) * alpha
    const py = c.prevY + (c.y - c.prevY) * alpha
    drawCompanion(cx, px, py, c.liveFragments.length, c.exposure, 0)
  }

  const p = w.player
  drawPlayer(cx, p.prevX + (p.x - p.prevX) * alpha, p.prevY + (p.y - p.prevY) * alpha,
             w.t - p.lastHurt < 0.12, p.retreating)

  cx.restore()

  // vignette. the dark closes in.
  const vg = cx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.30, vw / 2, vh / 2, Math.max(vw, vh) * 0.72)
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.78)')
  cx.fillStyle = vg; cx.fillRect(0, 0, vw, vh)

  // IND-34c: the recall. cold, not triumphant. the world goes away for a moment and
  // comes back somewhere quieter. it closes IN rather than flashing out, because
  // leaving is a contraction and the screen should agree with the fiction.
  if (w.recallFlash > 0) {
    const f = w.recallFlash
    cx.fillStyle = hex(P.void, f * 0.85)
    cx.fillRect(0, 0, vw, vh)
    const rg = cx.createRadialGradient(vw / 2, vh / 2, 0, vw / 2, vh / 2, Math.max(vw, vh) * 0.5 * (1 - f * 0.7))
    rg.addColorStop(0, hex(P.comp, f * 0.16)); rg.addColorStop(1, hex(P.comp, 0))
    cx.fillStyle = rg; cx.fillRect(0, 0, vw, vh)
  }
}
