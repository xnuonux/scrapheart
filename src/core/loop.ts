// Fixed timestep, interpolated render.
// Straight from ai-game-dev-kit/skills/game-loop. Law 2: anything else desyncs and
// breaks physics on slow hardware.

export const STEP = 1 / 60
const MAX_STEPS = 5

let stopUntil = 0
/** freeze the simulation but keep rendering. game-vfx: hitstop before particles. */
export const hitstop = (ms: number) => { stopUntil = performance.now() + ms }
export const frozen = () => performance.now() < stopUntil

export interface LoopHooks {
  simulate: (dt: number) => void
  render: (alpha: number) => void
}

export function startLoop({ simulate, render }: LoopHooks) {
  let last = performance.now()
  let acc = 0
  let lastDraw = 0

  // mobile frame budget. game-perf: a locked 30 beats an oscillating 45, and it
  // roughly halves thermal load.
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches
  const minFrameMs = coarse ? 33 : 0

  function frame(now: number) {
    requestAnimationFrame(frame)

    // a hidden tab must not simulate
    if (document.hidden) { last = now; return }
    if (minFrameMs && now - lastDraw < minFrameMs) return

    // hitstop renders, never simulates
    if (frozen()) { render(1); lastDraw = now; last = now; return }

    let dt = (now - last) / 1000
    last = now
    if (dt > 0.25) dt = 0.25 // returning from background: clamp, never replay

    acc += dt
    let steps = 0
    while (acc >= STEP && steps < MAX_STEPS) { simulate(STEP); acc -= STEP; steps++ }
    if (steps === MAX_STEPS) acc = 0 // give up on the backlog rather than spiral

    render(acc / STEP)
    lastDraw = now
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { last = performance.now(); acc = 0 }
  })

  requestAnimationFrame(frame)
}
