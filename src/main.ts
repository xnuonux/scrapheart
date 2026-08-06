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
    simulate(world, dt, mv, firing, input.hasAim ? input.aim : { x: world.player.x + 1, y: world.player.y })
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

  // pack count
  if (world.pack.length) {
    cx.textAlign = 'left'
    cx.fillStyle = hex(P.glow, 0.85)
    cx.fillText(`${world.pack.length} in pack  [I]`, 16, vh - 56)
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
    <h2>PACK</h2>
    ${world.pack.length === 0 ? '<p class="dim">nothing yet.</p>' : ''}
    ${world.pack.map((f, i) => `
      <div class="frag" data-i="${i}">
        <b>${f.name}</b>
        <span class="dim">${f.provenance}</span>
        <span class="kinds">${f.kinds.join(' · ')}</span>
      </div>`).join('')}
    ${c ? `<h2>SOCKETS</h2>${c.installed.map((f, i) =>
      `<div class="slot ${f ? 'full' : 'empty'}" data-s="${i}">${f ? f.name : 'empty'}</div>`).join('')}` : ''}
  `
}
setInterval(refreshPack, 400)

let selected = -1
ui.addEventListener('click', e => {
  const t = e.target as HTMLElement
  const fragEl = t.closest('.frag') as HTMLElement | null
  const slotEl = t.closest('.slot') as HTMLElement | null
  if (fragEl) { selected = +fragEl.dataset.i!; ui.querySelectorAll('.frag').forEach(el => el.classList.remove('sel')); fragEl.classList.add('sel') }
  else if (slotEl && selected >= 0 && world.companion) {
    const s = +slotEl.dataset.s!
    const f = world.pack[selected]
    if (f && world.companion.install(f, s)) {
      world.pack.splice(selected, 1); selected = -1
      world.log(`installed: ${f.name}`)
      refreshPack()
    }
  }
})

// naming. the P0 gate is whether people do this unprompted, so it is offered once
// and never asked for again.
const nameBtn = document.getElementById('name') as HTMLButtonElement
setInterval(() => {
  const c = world.companion
  nameBtn.style.display = c && !c.named ? 'block' : 'none'
}, 500)
nameBtn.onclick = () => {
  const c = world.companion; if (!c) return
  const n = prompt('call it something?')
  if (n && n.trim()) { c.name = n.trim().slice(0, 14); c.named = true; world.log(`you called it ${c.name}.`) }
  else c.named = true
}

;(window as any).world = world
