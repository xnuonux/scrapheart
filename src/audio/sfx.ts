// Procedural SFX. ai-game-dev-kit/skills/game-audio.
// A whole game's audio as a few hundred bytes of parameters. Zero files, zero
// licence risk, zero download weight, and it all sounds like one game because one
// synth made it.
//
// Law 3: never play the same sound twice identically.

import { zzfx } from 'zzfx'

let unlocked = false
export function unlockAudio() {
  if (unlocked) return
  unlocked = true
  try {
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
    const ctx = new AC()
    if (ctx.state === 'suspended') ctx.resume()
    const b = ctx.createBuffer(1, 1, 22050)
    const s = ctx.createBufferSource()
    s.buffer = b; s.connect(ctx.destination); s.start(0)
  } catch { /* audio simply will not play. never crash for it. */ }
}
;(['pointerdown', 'keydown', 'touchstart'] as const).forEach(e =>
  addEventListener(e, unlockAudio, { once: true, passive: true }))

let muted = false
export const setMuted = (m: boolean) => { muted = m }
export const isMuted = () => muted

// voice limiting: 300 things dying in one frame is clipping mud and a stalled thread
const last = new Map<string, number>()

// ZzFX params are deliberately sparse ([1.1, , 340, ...]) so the type admits undefined.
type ZP = (number | undefined)[]

function play(id: string, params: ZP, variance = 0.08, minGapMs = 35) {
  if (muted || !unlocked) return
  const now = performance.now()
  if (now - (last.get(id) ?? 0) < minGapMs) return
  last.set(id, now)
  const p = [...params]
  // pitch randomisation. the single highest-value rule in game audio.
  p[2] = (p[2] ?? 220) * (1 + (Math.random() * 2 - 1) * variance)
  try { (zzfx as any)(...p) } catch { /* never let audio kill a frame */ }
}

// Designed at killedbyapixel.github.io/ZzFX. Cold, dry, mechanical.
export const sfx = {
  fire:     () => play('fire',    [1.1, 0.05, 340, 0.01, 0.02, 0.06, 4, 1.9, , , , , , 1.4, , 0.1, , 0.5, 0.01], 0.10, 20),
  hit:      () => play('hit',     [1.4, 0.1, 180, 0.01, 0.03, 0.09, 4, 2.2, , , , , , 1.6, , 0.3, , 0.4, 0.02], 0.12, 25),
  hurt:     () => play('hurt',    [2.1, 0.1, 96, 0.02, 0.04, 0.14, 4, 2.6, , , , , , 1.2, , 0.4, , 0.5, 0.03], 0.06, 90),
  destroy:  () => play('destroy', [1.9, 0.15, 120, 0.03, 0.09, 0.28, 4, 1.7, , , , , , 1.5, , 0.5, 0.08, 0.35, 0.05], 0.10, 40),
  pickup:   () => play('pickup',  [0.7, 0.05, 820, , 0.03, 0.10, 1, 1.6, , , 420, 0.04], 0.09, 30),
  repair:   () => play('repair',  [0.6, 0.05, 300, 0.05, 0.12, 0.16, , 1.2, , , 180, 0.06, , , , , , 0.7, 0.05], 0.07, 200),
  overheat: () => play('overheat',[1.6, 0.2, 70, 0.06, 0.14, 0.30, 4, 1.4, , , , , , 2, , 0.6, 0.1, 0.3, 0.08], 0.05, 400),
  // IND-34c: leaving. a short downward fall, not a triumphant whoosh. you gave up
  // the room and the sound should know it.
  recall:   () => play('recall',  [1.2, 0.1, 480, 0.02, 0.10, 0.22, , 0.9, -6, , , , , , , 0.2, 0.02, 0.7, 0.04], 0.03, 300),
  // IND-34k: the warden announcing itself. A two-tone PA chime, the kind a building
  // plays before it does something routine. ⚠ Not a sting, not a menace cue. If this
  // sounds like a boss theme the beat is dead ... it has to sound like procedure.
  announce: () => play('announce', [1.3, 0, 392, 0.02, 0.42, 0.55, , 0.6, , , 262, 0.22, , , , , 0.02, 0.85, 0.28], 0, 2000),
  // IND-34m: one of only two original cues in the whole game. the machine stands up.
  stand:    () => play('stand',   [1.0, 0.1, 220, 0.10, 0.30, 0.45, , 1.1, , , 330, 0.10, 0.06, , , , 0.05, 0.9, 0.15], 0.02, 1000),
}
