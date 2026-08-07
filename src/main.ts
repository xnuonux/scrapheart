import { startLoop } from './core/loop'
import { input, bindInput } from './core/input'
import { World, simulate } from './game/world'
import { render, updateCamera, cam, addTrauma } from './render/draw'
import { P, hex } from './render/palette'
import { setMuted, isMuted } from './audio/sfx'

const canvas = document.getElementById('c') as HTMLCanvasElement
const cx = canvas.getContext('2d')!
const ui = document.getElementById('ui') as HTMLDivElement

let vw = 0, vh = 0
function resize() {
  // game-perf: cap DPR on touch. 3x on a phone is 9x the fragment work for a
  // difference nobody can see at arm's length.
  const coarse = matchMedia('(pointer:coarse)').matches
  const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2)
  vw = innerWidth; vh = innerHeight
  canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr)
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px'
  cx.setTransform(dpr, 0, 0, dpr, 0, 0)
  cx.imageSmoothingEnabled = false
}
addEventListener('resize', resize)
resize()

const world = new World()
cam.x = world.player.x; cam.y = world.player.y

bindInput(canvas, (sx, sy) => ({ x: sx - vw / 2 + cam.x, y: sy - vh / 2 + cam.y }))

let lastHp = world.player.hp

startLoop({
  simulate: dt => {
    const mv = input.axis2d()
    const firing = input.down('fire')
    // IND-34c: instant, always available, no cooldown. `pressed` not `down`, so it
    // fires on the edge and cannot be held.
    const recalling = input.pressed('recall')
    // IND-34a §3: hold [E] next to a damaged companion to repair it. `down`, not
    // `pressed` ... care is something you spend time on, which is the whole point.
    simulate(world, dt, mv, firing,
             input.hasAim ? input.aim : { x: world.player.x + 1, y: world.player.y },
             recalling, input.down('interact'))
    if (recalling) { cam.x = world.player.x; cam.y = world.player.y }
    updateCamera(world, dt)
    if (world.player.hp < lastHp) addTrauma(0.45)
    lastHp = world.player.hp
    input.endFrame()
  },
  render: alpha => {
    render(cx, world, alpha, vw, vh)
    drawHud()
  },
})

function drawHud() {
  const p = world.player, c = world.companion

  // heat, drawn as a bar because it is the only thing in the game that must be
  // read instantly (IND-34j)
  cx.fillStyle = hex(P.structure, 0.9); cx.fillRect(16, vh - 30, 160, 4)
  cx.fillStyle = p.overheated > 0 ? P.harm : P.lamp
  cx.fillRect(16, vh - 30, 160 * p.heat, 4)

  cx.fillStyle = hex(P.harmDim, 0.9); cx.fillRect(16, vh - 44, 160, 5)
  cx.fillStyle = P.player; cx.fillRect(16, vh - 44, 160 * (p.hp / p.maxHp), 5)

  // the companion panel. IND-34a: no affinity meter, no loyalty bar, no percentage.
  // what is shown is what it is MADE OF and what it is DOING.
  if (c) {
    cx.font = '11px ui-monospace, monospace'
    cx.textAlign = 'left'
    cx.fillStyle = P.comp
    cx.fillText(c.name || 'unnamed', 16, 26)
    cx.fillStyle = hex(P.compDim, 1)
    cx.fillText(c.behaviour.toUpperCase(), 16, 42)
    // sockets: filled, and empty. an empty socket is never hidden.
    for (let i = 0; i < c.installed.length; i++) {
      const f = c.installed[i]
      cx.fillStyle = f ? (f.worn > 0 ? P.glow : P.comp) : hex(P.compDim, 0.35)
      cx.fillRect(16 + i * 12, 50, 9, 9)
    }
    cx.fillStyle = hex(P.compDim, 0.7)
    cx.fillText(`RAM ${c.body.ram}`, 16 + c.installed.length * 12 + 10, 59)

    // IND-34a: it is hurt and you are near it. ⚠ The prompt appears because the
    // situation exists, never as a tutorial, and it never says what repairing is FOR.
    const near = Math.hypot(c.x - p.x, c.y - p.y) < 42
    if (c.hp < c.maxHp) {
      cx.fillStyle = hex(P.harm, 0.75)
      cx.fillRect(16, 66, 40, 3)
      cx.fillStyle = hex(P.harmDim, 0.6)
      cx.fillRect(16 + 40 * (c.hp / c.maxHp), 66, 40 * (1 - c.hp / c.maxHp), 3)
      if (near) {
        cx.fillStyle = hex(P.lamp, world.mending > 0 ? 0.95 : 0.6)
        cx.fillText(world.mending > 0 ? 'mending' : 'hold [E]', 62, 70)
      }
    }
  } else if (world.waiting) {
    // IND-34c: it is out there. ⚠ The one thing the player must not have to guess at,
    // because a companion they forget about is a companion that never survived them.
    cx.font = '11px ui-monospace, monospace'
    cx.textAlign = 'left'
    cx.fillStyle = hex(P.comp, 0.85)
    cx.fillText(world.waiting.c.name || 'it', 16, 26)
    cx.fillStyle = hex(P.compDim, 0.9)
    cx.fillText('waiting where you fell', 16, 42)
    // a bearing, not a marker. it points, it does not lead.
    const dx = world.waiting.x - p.x, dy = world.waiting.y - p.y
    const d = Math.hypot(dx, dy)
    if (d > 60) {
      const a = Math.atan2(dy, dx)
      cx.fillStyle = hex(P.comp, 0.5)
      cx.fillRect(16 + Math.cos(a) * 10, 56 + Math.sin(a) * 10, 3, 3)
      cx.fillText(`${Math.round(d)}`, 34, 60)
    }
  } else {
    cx.font = '11px ui-monospace, monospace'
    cx.fillStyle = hex(P.compDim, 0.8)
    cx.textAlign = 'left'
    cx.fillText('something is opened, to the east', 16, 26)
  }

  // the log. short, quiet, and it fades.
  cx.font = '11px ui-monospace, monospace'
  cx.textAlign = 'right'
  world.logs.forEach((l, i) => {
    const age = world.t - l.t
    const a = Math.max(0, 1 - age / 9) * (1 - i * 0.14)
    if (a <= 0) return
    cx.fillStyle = hex(P.player, a * 0.75)
    cx.fillText(l.text, vw - 16, 26 + i * 15)
  })

  // THE STAKE (IND-34c). The one place the game says the quiet part: what you are
  // holding can be lost, and one button keeps it. Four words teach the whole economy,
  // so this is the single piece of instructional text the P0 gets.
  cx.textAlign = 'left'
  // ⚠ the static hint bar already lists the keys. this line says the STAKE and
  // nothing else, and it appears only while there is something to lose.
  if (world.pack.length) {
    cx.fillStyle = hex(P.glow, 0.9)
    cx.fillText(`carrying ${world.pack.length}  ...  [Q] to keep`, 16, vh - 56)
  }
  if (world.banked.length) {
    cx.fillStyle = hex(P.lamp, 0.6)
    cx.fillText(`${world.banked.length} kept`, 16, vh - 70)
  }
}

// mute, persisted. game-audio: a game that ignores mute gets one-starred.
const MUTE_KEY = 'scrapheart.muted'
setMuted(localStorage.getItem(MUTE_KEY) === '1')
addEventListener('keydown', e => {
  if (e.code === 'KeyM') { setMuted(!isMuted()); localStorage.setItem(MUTE_KEY, isMuted() ? '1' : '0') }
  if (e.code === 'KeyI') ui.classList.toggle('open')
})

// the pack / assembly panel. IND-34h: assembly is still, quiet, no threat, no timer.
export function refreshPack() {
  const c = world.companion
  ui.innerHTML = `
    ${c ? `<div id="compname" class="${c.named ? 'named' : ''}">${c.name || 'unnamed'}</div>` : ''}
    <h2>PACK <span class="dim">at risk</span></h2>
    ${world.pack.length === 0 ? '<p class="dim">nothing yet.</p>' : ''}
    ${world.pack.map((f, i) => `
      <div class="frag" data-i="${i}">
        <b>${f.name}</b>
        <span class="dim">${f.provenance}</span>
        <span class="kinds">${f.kinds.join(' · ')}</span>
      </div>`).join('')}
    ${c ? `<h2>SOCKETS</h2>${c.installed.map((f, i) => {
      // ⚠ wear is shown on the socket, because pulling a piece out costs something and
      // the player has to be able to see what a fragment has already been through.
      const wear = f && f.degradation > 0 ? ` <span class="dim">${Math.round(f.degradation * 100)}% worn</span>` : '';
      return `<div class="slot ${f ? 'full' : 'empty'}" data-s="${i}">${f ? f.name + wear : 'empty'}</div>`;
    }).join('')}` : ''}
    ${world.banked.length ? `<h2>KEPT <span class="dim">safe</span></h2>${world.banked.map((f, i) =>
      `<div class="frag kept" data-k="${i}"><b>${f.name}</b><span class="dim">${f.provenance}</span>
       <span class="kinds">${f.kinds.join(' · ')}</span></div>`).join('')}` : ''}
  `
}
setInterval(refreshPack, 400)

// selection carries WHICH list it came from. a kept fragment is installable too ...
// banking that made a part unusable would just be a worse pocket.
let selected: { from: 'pack' | 'banked'; i: number } | null = null
ui.addEventListener('click', e => {
  const t = e.target as HTMLElement
  const fragEl = t.closest('.frag') as HTMLElement | null
  const slotEl = t.closest('.slot') as HTMLElement | null
  if (fragEl) {
    const k = fragEl.dataset.k
    selected = k !== undefined ? { from: 'banked', i: +k } : { from: 'pack', i: +fragEl.dataset.i! }
    ui.querySelectorAll('.frag').forEach(el => el.classList.remove('sel'))
    fragEl.classList.add('sel')
  } else if (slotEl && world.companion) {
    const s = +slotEl.dataset.s!
    // ⚠ a FILLED socket clicked with nothing selected means "take it out". this was the
    // missing half of the socket economy: install existed, remove did not, so a full
    // companion could never change again for the rest of the run.
    if (world.companion.installed[s] && !selected) {
      const name = world.companion.installed[s]!.name
      const out = world.companion.remove(s)
      if (out.destroyed) world.log(`${name} came apart in your hands.`)
      else if (out.fragment) {
        world.pack.push(out.fragment)
        const pct = Math.round(out.fragment.degradation * 100)
        world.log(`pulled: ${name}${pct ? ` (${pct}% worn)` : ''}`)
      }
      refreshPack()
      return
    }
    if (!selected) return
    const list = selected.from === 'pack' ? world.pack : world.banked
    const f = list[selected.i]
    if (f && world.companion.install(f, s)) {
      list.splice(selected.i, 1); selected = null
      world.log(`installed: ${f.name}`)
      refreshPack()
    }
  }
})

/**
 * 🚨 NAMING, AND WHY THERE IS NO BUTTON.
 *
 * The P0 gate is "seven of ten name the companion UNPROMPTED". This used to be a
 * `<button>give it a name</button>` that appeared the moment the machine stood up.
 *
 * ⚠ That button made the gate unmeasurable. A player who clicks a control labelled
 * "give it a name" has followed an instruction; a player who names a thing nobody asked
 * them to name has formed an attachment. Those are different events and only one of
 * them is the thing being tested ... and the button would have produced a number that
 * looked like a pass.
 *
 * So naming lives here instead: the name field in the pack panel, where you are already
 * assembling the thing. It reads `unnamed` and nothing else. No label, no call to
 * action, no hint in the key list. **Discoverable, never offered.**
 */
ui.addEventListener('click', e => {
  const el = (e.target as HTMLElement).closest('#compname') as HTMLElement | null
  if (!el) return
  const c = world.companion; if (!c) return
  const n = prompt(c.name ? 'call it what?' : '?')       // ⚠ not a sentence. not an ask.
  if (n && n.trim()) {
    c.name = n.trim().slice(0, 14); c.named = true
    world.log(`you called it ${c.name}.`)
    refreshPack()
  }
})

;(window as any).world = world
