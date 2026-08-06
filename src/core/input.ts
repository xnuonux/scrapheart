// The intent layer. ai-game-dev-kit/skills/game-input:
// "never read a device in your game code. read an INTENT."
// Retrofitting this after gameplay is written means touching every system.

export type Intent = 'up' | 'down' | 'left' | 'right' | 'fire' | 'recall' | 'interact' | 'pause'

const KEYMAP: Record<string, Intent> = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'fire',
  KeyQ: 'recall',
  KeyE: 'interact',
  Escape: 'pause',
}

class InputState {
  private held = new Set<Intent>()
  private justPressed = new Set<Intent>()
  /** aim point in world space, set by mouse or by the touch drag */
  aim = { x: 0, y: 0 }
  hasAim = false
  scheme: 'kbm' | 'touch' | 'gamepad' = 'kbm'

  down(i: Intent) { return this.held.has(i) }
  pressed(i: Intent) { return this.justPressed.has(i) }

  /** merged movement from keys, stick, or virtual stick. always normalised. */
  axis2d() {
    let x = 0, y = 0
    if (this.held.has('left')) x--
    if (this.held.has('right')) x++
    if (this.held.has('up')) y--
    if (this.held.has('down')) y++
    if (this.stick.active) { x = this.stick.x; y = this.stick.y }
    const m = Math.hypot(x, y)
    return m > 1 ? { x: x / m, y: y / m } : { x, y }
  }

  stick = { active: false, x: 0, y: 0, ox: 0, oy: 0 }

  _set(i: Intent, on: boolean) {
    if (on) { if (!this.held.has(i)) this.justPressed.add(i); this.held.add(i) }
    else this.held.delete(i)
  }
  endFrame() { this.justPressed.clear() }
}

export const input = new InputState()

export function bindInput(canvas: HTMLCanvasElement, toWorld: (sx: number, sy: number) => {x:number,y:number}) {
  addEventListener('keydown', e => {
    const i = KEYMAP[e.code]
    if (i) { input._set(i, true); input.scheme = 'kbm'; e.preventDefault() }
  })
  addEventListener('keyup', e => {
    const i = KEYMAP[e.code]
    if (i) input._set(i, false)
  })

  // Pointer Events only. game-input: one code path for mouse, touch and pen,
  // and pointercancel MUST be handled or inputs stick on.
  const FLOAT_STICK_ID = { id: -1 }

  canvas.addEventListener('pointerdown', e => {
    // 🚨 setPointerCapture THROWS if the pointer is already gone ("No active pointer
    // with the given id"), and it was the first line of this handler, so the throw took
    // the fire, the aim and the stick with it. A dropped input is invisible: the player
    // taps and nothing happens and there is nothing in the log.
    //
    // ⚠ Capture is an optimisation (it keeps drags alive outside the canvas). Input is
    // not. Never let the optimisation be able to cancel the thing it is optimising.
    try { canvas.setPointerCapture(e.pointerId) } catch { /* capture is a nicety */ }
    if (e.pointerType === 'touch') {
      input.scheme = 'touch'
      // floating stick on the left half, fire/aim on the right.
      // game-input: a FIXED stick means the thumb must find it.
      if (e.clientX < innerWidth / 2 && FLOAT_STICK_ID.id === -1) {
        FLOAT_STICK_ID.id = e.pointerId
        input.stick.active = true
        input.stick.ox = e.clientX; input.stick.oy = e.clientY
        input.stick.x = 0; input.stick.y = 0
      } else {
        input._set('fire', true)
        const w = toWorld(e.clientX, e.clientY); input.aim = w; input.hasAim = true
      }
    } else {
      input.scheme = 'kbm'
      input._set('fire', true)
      const w = toWorld(e.clientX, e.clientY); input.aim = w; input.hasAim = true
    }
    e.preventDefault()
  }, { passive: false })

  canvas.addEventListener('pointermove', e => {
    if (e.pointerId === FLOAT_STICK_ID.id) {
      const dx = e.clientX - input.stick.ox, dy = e.clientY - input.stick.oy
      const m = Math.hypot(dx, dy), max = 56
      const s = m > max ? max / m : 1
      input.stick.x = (dx * s) / max; input.stick.y = (dy * s) / max
    } else {
      const w = toWorld(e.clientX, e.clientY); input.aim = w; input.hasAim = true
    }
    e.preventDefault()
  }, { passive: false })

  const release = (e: PointerEvent) => {
    if (e.pointerId === FLOAT_STICK_ID.id) {
      FLOAT_STICK_ID.id = -1
      input.stick.active = false; input.stick.x = 0; input.stick.y = 0
    } else input._set('fire', false)
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release) // ⚠ forgetting this leaves inputs stuck ON
}
