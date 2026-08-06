// Procedural machine sprites.
//
// game-art says P0 is flat shapes on the final palette at final size, and that this
// is genuinely shippable as a style. It is also thematically correct here: the world
// is machines ASSEMBLED FROM PARTS, so sprites assembled from parts is honest.
//
// Every machine is drawn from a seed, so the same wreck looks the same forever
// without storing a single pixel.

import { P, hex, mix } from './palette'

const R = (seed: number) => {
  let s = seed | 0
  return () => { s = (s * 16807) % 2147483647; return (s < 0 ? s + 2147483647 : s) / 2147483647 }
}

/** a stopped machine: silhouette first, because at phone size nobody sees detail. */
export function drawWreck(cx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number, on = false) {
  const r = R(seed | 1)
  const body = on ? P.stopped : mix(P.ground2, P.machine, 0.35)
  cx.fillStyle = body

  // core mass
  const w = s * (0.7 + r() * 0.6), h = s * (0.5 + r() * 0.7)
  cx.fillRect(x - w / 2, y - h / 2, w, h)

  // limbs: two to four, at angles, of decreasing length
  const limbs = 2 + Math.floor(r() * 3)
  for (let i = 0; i < limbs; i++) {
    const a = r() * Math.PI * 2
    const len = s * (0.4 + r() * 0.9)
    const th = Math.max(2, s * 0.16)
    cx.save(); cx.translate(x, y); cx.rotate(a)
    cx.fillRect(0, -th / 2, len, th)
    cx.restore()
  }

  // a highlight edge on one side, so the silhouette reads as a volume
  cx.fillStyle = hex(P.machineHi, on ? 0.35 : 0.18)
  cx.fillRect(x - w / 2, y - h / 2, w, Math.max(1, s * 0.12))

  // IND-34l: the ones that gave up are STILL ON. that is the whole tell.
  // if the player cannot distinguish them from wreckage, the category does not exist.
  if (on) {
    const pulse = 0.45 + Math.sin(performance.now() / 900 + seed) * 0.25
    cx.fillStyle = hex(P.lamp, pulse)
    cx.fillRect(x - 1, y - h / 2 - 3, 2, 2)
  }
}

/** an active machine. same construction, colder colour, and it moves. */
export function drawMachine(cx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number, wind: number) {
  const r = R(seed | 1)
  const lean = wind * 3

  cx.fillStyle = P.machine
  const w = s * 1.4, h = s * 1.2
  cx.fillRect(x - w / 2 + lean, y - h / 2, w, h)

  const legs = 3
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * Math.PI * 2 + r() * 0.6
    const len = s * (0.8 + r() * 0.5)
    cx.save(); cx.translate(x, y); cx.rotate(a)
    cx.fillRect(0, -1.5, len, 3)
    cx.restore()
  }

  cx.fillStyle = P.machineHi
  cx.fillRect(x - w / 2 + lean, y - h / 2, w, 2)

  // the telegraph. they were built to be safe around humans and that safety system
  // is one of the few things still working (IND-34j).
  if (wind > 0) {
    cx.strokeStyle = hex(P.harm, Math.min(1, wind))
    cx.lineWidth = 2
    cx.beginPath(); cx.arc(x, y, 18 + wind * 34, 0, Math.PI * 2); cx.stroke()
  }
}

/** the companion. assembled, so its silhouette grows with what is installed. */
export function drawCompanion(
  cx: CanvasRenderingContext2D, x: number, y: number, parts: number, exposure: number, hurt: number,
) {
  if (exposure > 0) {
    cx.strokeStyle = hex(P.comp, 0.22 * exposure)
    cx.lineWidth = 1
    cx.beginPath(); cx.arc(x, y, 11 + exposure * 7, 0, Math.PI * 2); cx.stroke()
  }
  const c = hurt > 0 ? P.playerHi : P.comp
  cx.fillStyle = c
  cx.fillRect(x - 5, y - 5, 10, 10)
  // one small mark per installed fragment. you can read what it is made of.
  cx.fillStyle = hex(P.compDim, 0.9)
  for (let i = 0; i < parts; i++) cx.fillRect(x - 5 + i * 4, y + 6, 3, 2)
  // the light it has instead of a face
  cx.fillStyle = hex(P.glow, 0.8)
  cx.fillRect(x - 1, y - 2, 2, 2)
}

/**
 * IND-34k: the handler. Somebody else's design, so it does NOT share the companion's
 * construction language ... no sockets to read, no parts to count. It is warm rather
 * than cold, because it is the only friendly thing in the game the player did not build.
 * ⚠ Small, low to the ground, and it bobs. It has to be likeable on its own terms.
 */
export function drawHandler(cx: CanvasRenderingContext2D, x: number, y: number, bob: number) {
  const b = Math.sin(bob) * 1.2
  cx.fillStyle = mix(P.lamp, P.machine, 0.55)
  cx.fillRect(x - 6, y - 3 + b, 12, 6)          // body, long and low
  cx.fillRect(x + 4, y - 6 + b, 5, 5)           // head, forward
  cx.fillStyle = hex(P.structure, 0.9)
  cx.fillRect(x - 5, y + 3, 2, 3)               // legs, planted while the body bobs
  cx.fillRect(x + 3, y + 3, 2, 3)
  cx.fillStyle = hex(P.lamp, 0.95)              // the light where an eye would be
  cx.fillRect(x + 6, y - 5 + b, 2, 2)
}

/**
 * IND-34k: the warden. Bigger, slower, and it does not look angry. It looks like
 * equipment. ⚠ The telegraph is enormous because a warden is not trying to trick you,
 * it is warning you, exactly as it was built to.
 */
export function drawWarden(cx: CanvasRenderingContext2D, x: number, y: number, s: number, wind: number) {
  const lean = wind * 4
  cx.fillStyle = mix(P.machine, P.void, 0.25)
  cx.fillRect(x - s * 0.8 + lean, y - s * 0.9, s * 1.6, s * 1.8)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    cx.save(); cx.translate(x, y); cx.rotate(a)
    cx.fillRect(0, -3, s * 1.5, 6)
    cx.restore()
  }
  cx.fillStyle = hex(P.machineHi, 0.5)
  cx.fillRect(x - s * 0.8 + lean, y - s * 0.9, s * 1.6, 3)
  // the working light. amber, because it is a maintenance unit doing maintenance.
  const pulse = 0.5 + Math.sin(performance.now() / 260) * 0.35
  cx.fillStyle = hex(P.lamp, pulse)
  cx.fillRect(x - 3, y - s * 0.9 - 6, 6, 4)
  if (wind > 0) {
    cx.strokeStyle = hex(P.harm, Math.min(0.95, wind * 0.75))
    cx.lineWidth = 3
    cx.beginPath(); cx.arc(x, y, 40 + wind * 58, 0, Math.PI * 2); cx.stroke()
  }
}

export function drawPlayer(cx: CanvasRenderingContext2D, x: number, y: number, hurt: boolean, retreating: boolean) {
  cx.fillStyle = hurt ? P.playerHi : P.player
  cx.beginPath(); cx.arc(x, y, 7, 0, Math.PI * 2); cx.fill()
  if (retreating) {
    cx.strokeStyle = hex(P.lamp, 0.5); cx.lineWidth = 1
    cx.beginPath(); cx.arc(x, y, 13, 0, Math.PI * 2); cx.stroke()
  }
}
