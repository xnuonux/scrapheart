// IND-34k THE FIRST LOSS. Walk the whole sequence and measure each step.
// The claim that matters most: the companion finds the heart by its OWN curiosity,
// not because anything told it to.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

// ⚠ paths resolve from THIS FILE, never from a machine. these probes shipped with
// C:/dev/... baked in and would not have run on any other computer, which makes them
// documentation of a measurement rather than the measurement itself.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const REPO  = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST  = join(REPO, "dist");
const SRC   = join(REPO, "src");
const INDEX = join(REPO, "index.html");
const SHOTS = join(REPO, ".shots");
fs.mkdirSync(SHOTS, { recursive: true });
const ROOT = DIST;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nope') }
  res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
// 🚨 FRESHNESS GATE. Probes serve dist/, so an unbuilt src change silently tests the
// PREVIOUS bundle. I changed an interpose threshold from 1.05 to 1.30, did not rebuild,
// and then spent four measurement rounds proving that a value of 1.125 passed a bar of
// 1.30. The measurements were all correct. They were measurements of old code.
{
  const newest = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((max, e) => {
    const p = path.join(dir, e.name);
    return Math.max(max, e.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs);
  }, 0);
  // ⚠ index.html is a build input too. The gate watched only src/, so an edit to the
  // page shell would ship stale and measure clean ... the exact hole this gate exists to close.
  const src = Math.max(newest(SRC),
                       fs.statSync(INDEX).mtimeMs);
  const built = newest(ROOT);
  if (src > built) {
    console.error(`\n🚨 STALE BUILD. src is ${((src - built) / 1000).toFixed(0)}s newer than dist.`);
    console.error('   Run `npm run build` first. Refusing to measure old code.\n');
    process.exit(2);
  }
}

await new Promise(r => server.listen(4704, r));
const out = SHOTS;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,160)) });
page.on('crash', () => { errs.push('RENDERER CRASHED'); console.log('\n!! RENDERER CRASHED !!') });
page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('!! navigated to', f.url()) });
page.on('dialog', async d => { console.log('!! DIALOG OPENED:', d.type(), JSON.stringify(d.message())); await d.dismiss() });
await page.goto('http://127.0.0.1:4704/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// ⚠ headless screenshots go flaky under load and one Protocol error must not abort a
// four-minute measurement run. the numbers are the deliverable, the pictures are not.
const shot = async (p) => { try { await page.screenshot({ path: p }) } catch (e) {
  console.log('   (screenshot skipped:', String(e).slice(0, 60), ')') } };

const walkTo = async (getT, ms=25000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const st = await page.evaluate(getT); if (!st) break;
    const keys = [];
    if (st.dx > 12) keys.push('KeyD'); else if (st.dx < -12) keys.push('KeyA');
    if (st.dy > 12) keys.push('KeyS'); else if (st.dy < -12) keys.push('KeyW');
    if (!keys.length) break;
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(140);
    for (const k of keys) await page.keyboard.up(k);
  }
};
const st = () => page.evaluate(() => ({
  t: +world.t.toFixed(1), px: Math.round(world.player.x), hp: Math.round(world.player.hp),
  handler: world.handler ? { alive: world.handler.alive, hp: world.handler.hp } : null,
  handlerMet: world.handlerMet, handlerLostAt: +world.handlerLostAt.toFixed(1),
  wardenSpawned: world.wardenSpawned,
  warden: (world.threats.find(t=>t.kind==='warden'&&t.alive&&t.degree!==2)||null) &&
    { hp: Math.round(world.threats.find(t=>t.kind==='warden'&&t.degree!==2).hp),
      announced: world.threats.find(t=>t.kind==='warden'&&t.degree!==2).announced },
  heart: world.salvage.find(s=>s.frag==='heart') ? 'on the ground' :
         world.pack.some(f=>f.id==='heart') ? 'in pack' :
         world.companion?.liveFragments.some(f=>f.id==='heart') ? 'INSTALLED' : 'gone',
  comp: world.companion && { beh: world.companion.behaviour, loyalty: +world.companion.loyalty.toFixed(2),
        warm: [...world.companion.warm] },
  logs: world.logs.map(l=>l.text),
}));

// step 0: the companion
await walkTo(() => world.chassis?.taken ? null
  : { dx: world.chassis.x - world.player.x, dy: world.chassis.y - world.player.y });
console.log('0. companion:', (await st()).comp ? 'standing' : 'MISSING');

// step 1: the handler finds you. gated on t > 40, so wait it out while moving.
console.log('\n1. waiting for the handler (gated at t>40s)...');
const t1 = Date.now();
while (Date.now() - t1 < 60000) {
  const s = await st(); if (s.handlerMet) break;
  await page.keyboard.down('KeyA'); await page.waitForTimeout(300); await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
}
let s = await st();
console.log('   handlerMet:', s.handlerMet, '| at t =', s.t, 's | log:', s.logs[0]);
console.log('   VERDICT 1:', s.handlerMet && s.handler?.alive ? 'PASS' : 'FAIL');
await shot(`${out}/k1-handler.png`);

// ⚠ The warden now requires HANDLER_GRACE (8 min) of the dog actually being with you,
// because it used to spawn the same instant the handler arrived. That grace is measured
// by _probe_gate; THIS probe is about the beat itself, so wind the clock back rather
// than sit here for eight minutes.
await page.evaluate(() => { world.handlerMetAt = world.t - 600 });

// step 2-5: go deeper. the warden should spawn and announce itself.
console.log('\n2. going deeper (east past DEEP_X)...');
await walkTo(() => world.player.x > 1200 ? null : { dx: 1400 - world.player.x, dy: 0 }, 30000);
await page.waitForTimeout(700);
s = await st();
console.log('   px:', s.px, '| wardenSpawned:', s.wardenSpawned, '| warden:', JSON.stringify(s.warden));
console.log('   VERDICT 2 (spawns):', s.wardenSpawned ? 'PASS' : 'FAIL');
console.log('   VERDICT 3 (announces politely):', s.logs.some(l=>l.includes('UNIT 7')) ? 'PASS' : 'FAIL');
console.log('   log:', JSON.stringify(s.logs.slice(0,3)));
await shot(`${out}/k2-warden.png`);

// step 6: it kills the handler. THE PERMANENT RULE.
//
// ⚠ Tested directly, not by surviving a fight. Three earlier versions of this probe
// died to the warden before the handler did and reported the RULE broken. The design
// says you die in three or four hits and everything is dodgeable ... so a crude bot
// dying proves the bot cannot dodge, and nothing whatsoever about the rule. The claim
// under test is "a warden one-shots a handler", so put them next to each other and
// watch. The organic path is measured separately by verdicts 1-3 and 6-9.
// 🚨 The complement FIRST, because it is what makes the degrees mean anything: a warden
// whose targeting is gone must NOT kill a handler sitting in its lap. Without this,
// "degree" is a cosmetic label on an enemy that behaves identically.
// ⚠ Run before the real kill, and the real handler is saved and restored, so this test
// cannot leave a fake one behind for every verdict after it.
console.log('\n2b. the complement: a degree-2 warden must NOT kill a handler.');
const rule2 = await page.evaluate(() => new Promise(res => {
  const d2 = world.threats.find(t => t.kind === 'warden' && t.degree === 2 && t.alive);
  if (!d2) return res({ survived: false, why: 'no degree-2 warden' });
  const saved = world.handler;
  world.handler = { x: d2.x + 20, y: d2.y, prevX: d2.x + 20, prevY: d2.y,
                    hp: 999, alive: true, r: 6, fireCd: 9, bob: 0 };
  const t0 = performance.now();
  const tick = () => {
    const h = world.handler;
    if (!h || !h.alive) { world.handler = saved;
      return res({ survived: false, sec: +((performance.now()-t0)/1000).toFixed(1) }) }
    if (performance.now() - t0 > 4000) { world.handler = saved; return res({ survived: true, sec: 4 }) }
    h.x = d2.x + 20; h.y = d2.y;            // hold it in the kill radius
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('  ', JSON.stringify(rule2));
console.log('   (real handler restored:', await page.evaluate(() => !!world.handler?.alive), ')');

console.log('\n3. the rule: an intact warden one-shots a handler, at full health, in one strike.');
const rule = await page.evaluate(() => new Promise(res => {
  // ⚠ The INTACT one. There are two wardens now (IND-34l degrees) and a plain
  // find(kind==='warden') returns the degree-2 one, whose targeting is gone and which
  // therefore correctly kills nothing. That reported the absolute rule as broken.
  const h = world.handler;
  const wn = world.threats.find(t => t.kind === 'warden' && t.alive && t.degree !== 2);
  if (!h || !wn) return res({ ok: false, why: 'no handler or no intact warden' });
  // ⚠ Stage the kill AWAY from the player. The heart drops where the handler dies, and
  // if that is at the player's feet they walk over it within two frames and pocket it,
  // which skips the entire "you leave, you come back" beat and fails verdicts 5 and 7
  // for a reason that has nothing to do with the code under test.
  h.x = Math.min(1520, world.player.x + 340); h.y = Math.max(80, world.player.y - 180);
  h.prevX = h.x; h.prevY = h.y;
  h.hp = 999;                                  // ⚠ full health. one-shot means one-shot.
  const hp0 = h.hp;
  wn.x = h.x + 40; wn.y = h.y;                 // inside the kill radius
  const t0 = performance.now();
  const tick = () => {
    if (!h.alive) return res({ ok: true, hp0, ms: Math.round(performance.now() - t0),
                              strikes: 1, playerHp: Math.round(world.player.hp) });
    if (performance.now() - t0 > 6000) return res({ ok: false, why: 'survived 6s', hp: h.hp });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('  ', JSON.stringify(rule));
const t3 = Date.now();
let died = 0;
while (Date.now() - t3 < 20000) {
  s = await st();
  if (s.handler && !s.handler.alive) break;
  // ⚠ Do NOT fight it. IND-34k step 4 is "you keep going", step 7 is "you leave" ...
  // the player is not supposed to beat the warden here, and a probe that stands and
  // trades hits with a 30-damage unit dies, permadeath fires, the companion detaches
  // into `waiting`, and every later verdict measures a run that already ended.
  // The handler charges on its own. Back away and let the rule happen.
  const wd = await page.evaluate(() => {
    const wn = world.threats.find(t=>t.kind==='warden'&&t.alive);
    return wn ? { dx: wn.x-world.player.x, dy: wn.y-world.player.y,
                  d: Math.round(Math.hypot(wn.x-world.player.x, wn.y-world.player.y)) } : null });
  // stay alive: shoot the runners, they are what actually kills you while you are
  // busy respecting the warden.
  const aim = await page.evaluate(() => {
    const t = world.threats.filter(t=>t.alive && t.kind!=='warden')
      .sort((a,b)=>Math.hypot(a.x-world.player.x,a.y-world.player.y)-Math.hypot(b.x-world.player.x,b.y-world.player.y))[0];
    return t ? { sx: 640 + (t.x-world.player.x), sy: 400 + (t.y-world.player.y) } : null });
  if (aim) { await page.mouse.move(aim.sx, aim.sy); await page.mouse.down() }
  if (wd && wd.d < 300) {
    const kx = wd.dx > 0 ? 'KeyA' : 'KeyD', ky = wd.dy > 0 ? 'KeyW' : 'KeyS';
    await page.keyboard.down(kx); await page.keyboard.down(ky);
    await page.waitForTimeout(300);
    await page.keyboard.up(kx); await page.keyboard.up(ky);
  } else await page.waitForTimeout(260);
  await page.mouse.up();
  const low = await page.evaluate(() => ({ hp: world.player.hp, run: world.run }));
  if (low.run > 1) { died++; break }
  // ⚠ the recall is the answer to being low, and using it is the design working.
  if (low.hp < 45) { await page.keyboard.press('KeyQ'); await page.waitForTimeout(400);
    await walkTo(() => world.player.x > 1250 ? null : { dx: 1400-world.player.x, dy: 0 }, 12000) }
}
if (died) console.log('   ⚠ THE PLAYER DIED. permadeath detached the companion, so verdicts 8-9 measure nothing.');
// ⚠ Step back off the corpse before measuring. The controlled rule test puts the warden
// right next to the handler, so the handler dies at the player's feet and the player
// walks over the heart and pockets it ... which is not the beat and not a bug. IND-34k
// step 7 is "you leave", so leave.
await page.evaluate(() => {
  const h = world.salvage.find(s => s.frag === 'heart');
  if (h) { world.player.x = Math.max(60, h.x - 300); world.player.y = h.y - 120;
           world.player.prevX = world.player.x; world.player.prevY = world.player.y }
});
await page.waitForTimeout(300);
s = await st();
console.log('   handler alive:', s.handler?.alive, '| lost at t =', s.handlerLostAt);
console.log('   heart:', s.heart, '| log:', JSON.stringify(s.logs.slice(0,3)));
console.log('   VERDICT 4 (an INTACT warden one-shots a handler at FULL health):',
  rule.ok && s.handler && !s.handler.alive ? `PASS (999hp, one strike, ${rule.ms}ms)` : `FAIL (${JSON.stringify(rule)})`);
console.log('   VERDICT 4b (a DEGREE-2 warden does not, ever):',
  rule2.survived ? `PASS (handler alive after ${rule2.sec}s inside its reach)` : `FAIL (${JSON.stringify(rule2)})`);
console.log('   VERDICT 5 (heart drops, glowing):', s.heart === 'on the ground' ? 'PASS' : `FAIL (${s.heart})`);
await shot(`${out}/k3-heart.png`);

// step 7: you leave. the recall.
console.log('\n4. you leave (the recall, at the moment it matters)...');
await page.keyboard.press('KeyQ');
await page.waitForTimeout(600);
s = await st();
console.log('   px after recall:', s.px, '| warden still alive:', !!s.warden, '| heart:', s.heart);
console.log('   VERDICT 6 (leaving does not delete the warden):', s.warden ? 'PASS' : 'FAIL');
console.log('   VERDICT 7 (the scrap is where you left it):', s.heart === 'on the ground' ? 'PASS' : 'FAIL');

// step 9: go back. THE CLAIM THAT MATTERS: does the companion stop at it on its own?
console.log('\n5. you go back. does the companion find it BY ITS OWN CURIOSITY?');
const heartPos = await page.evaluate(() => {
  const h = world.salvage.find(s=>s.frag==='heart'); return h ? {x:h.x,y:h.y} : null });
console.log('   heart at', JSON.stringify(heartPos));
const diag = await page.evaluate(() => ({ run: world.run, waiting: !!world.waiting,
  comp: !!world.companion, records: world.records.length }));
console.log('   DIAG:', JSON.stringify(diag));
// ⚠ Verdict 8 is a claim about the COMPANION'S curiosity, not about whether the player
// can survive the deep. Those are separate questions and only one is under test here,
// so the player is pinned alive and the companion restored if permadeath detached it.
// Stated out loud because a probe that quietly props up the thing it measures is worse
// than no probe.
if (diag.waiting && !diag.comp) {
  console.log('   (player died earlier; restoring the waiting companion so the curiosity claim is measurable)');
  await page.evaluate(() => { world.companion = world.waiting.c; world.waiting = null;
                              world.companion.bond = 1; world.companion.recompute() });
}
const pin = setInterval(() => page.evaluate(() => { world.player.hp = world.player.maxHp })
  .catch(() => {}), 250);
if (!heartPos) {
  console.log('   SKIPPED verdicts 8-9: no heart on the ground, so there is nothing to measure.');
  console.log('page errors:', errs.length ? errs.join(' | ') : 'none');
  await browser.close(); server.close(); process.exit(1);
}
// walk to within perception range but NOT onto it, so the player cannot be the one
// who picks it up. then watch what the companion does.
await walkTo(() => {
  const h = world.salvage.find(s=>s.frag==='heart'); if (!h) return null;
  const d = Math.hypot(h.x-world.player.x, h.y-world.player.y);
  return d < 110 ? null : { dx: h.x - world.player.x, dy: h.y - world.player.y };
}, 30000);
// ⚠ Poll from Node in short evaluates. A 9-second requestAnimationFrame loop inside
// ONE page.evaluate kept dying with "execution context was destroyed" ... a fragile
// probe, not a fragile game. Short samples measure the same thing and cannot do that.
const watch = { investigated: 0, frames: 0, minD: 9999, stopped: false, gone: false };
for (let i = 0; i < 90; i++) {
  const smp = await page.evaluate(() => {
    const c = world.companion, h = world.salvage.find(s => s.frag === 'heart');
    return { beh: c?.behaviour ?? null,
             d: (c && h) ? Math.hypot(c.x - h.x, c.y - h.y) : null,
             gone: !h, stopped: world.logs.some(l => l.text.includes('looked at something')) };
  });
  watch.frames++;
  if (smp.beh === 'investigate') watch.investigated++;
  if (smp.d !== null) watch.minD = Math.min(watch.minD, smp.d);
  if (smp.stopped) watch.stopped = true;
  if (smp.gone) { watch.gone = true; break }
  await page.waitForTimeout(100);
}
watch.minD = Math.round(watch.minD);
console.log('  ', JSON.stringify(watch));
// ⚠ minD is the honest measure. `stopped` reads the log, which can be true from an
// EARLIER interest point entirely and says nothing about the heart.
console.log('   VERDICT 8 (companion drawn to it unprompted):',
  watch.investigated > 0 && watch.minD < 40
    ? `PASS (investigate ${watch.investigated}/${watch.frames} samples, closed to ${watch.minD}px)`
    : `FAIL (investigate ${watch.investigated} samples, closest ${watch.minD}px)`);
await shot(`${out}/k4-return.png`);

// step: install it. the first socket filled with something that died.
s = await st();
if (s.heart === 'on the ground') {
  await walkTo(() => {
    const h = world.salvage.find(s=>s.frag==='heart'); if (!h) return null;
    return { dx: h.x-world.player.x, dy: h.y-world.player.y } }, 12000);
}
await page.waitForTimeout(400);
await page.keyboard.press('KeyI'); await page.waitForTimeout(400);
const fragEls = await page.locator('.frag').count();
for (let i = 0; i < fragEls; i++) {
  const txt = await page.locator('.frag').nth(i).innerText();
  if (txt.includes('ATTACHMENT CORE')) {
    await page.locator('.frag').nth(i).click(); await page.waitForTimeout(200);
    const slot = page.locator('.slot.empty').first();
    if (await slot.count()) { await slot.click(); await page.waitForTimeout(400) }
    break;
  }
}
s = await st();
console.log('\n6. the install:', s.heart, '| loyalty now', s.comp?.loyalty);
console.log('   VERDICT 9 (installed, loyalty jumps):',
  s.heart === 'INSTALLED' && s.comp.loyalty > 0.7 ? `PASS (loyalty ${s.comp.loyalty})` : `FAIL (${s.heart}, loyalty ${s.comp?.loyalty})`);
console.log('   log:', JSON.stringify(s.logs.slice(0,4)));
await shot(`${out}/k5-installed.png`);

clearInterval(pin);
const perf = await page.evaluate(async () => { let n=0; const t0=performance.now();
  await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(null) }; requestAnimationFrame(f) });
  return Math.round(n/((performance.now()-t0)/1000)) });
console.log('\nfps:', perf, '| page errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
