// THE SOCKET ECONOMY. IND-34a: "pulling a fragment out degrades it, and one cycled three
// or four times is worn to nothing" ... and IND-34i: a lived-in (worn) fragment barely
// degrades, "its value is not that it hits harder, it is that it is the one you can
// afford to experiment with."
//
// 🚨 None of that existed. `install` only filled empty slots, nothing removed, and
// `degradeOnRemoval` was written and never called. A companion with three full sockets
// was frozen for the rest of the run.
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
{ const newest = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((max, e) => {
    const p = path.join(dir, e.name);
    return Math.max(max, e.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs); }, 0);
  const srcT = Math.max(newest(SRC), fs.statSync(INDEX).mtimeMs);
  if (srcT > newest(ROOT)) { console.error('\n🚨 STALE BUILD.\n'); process.exit(2) } }
await new Promise(r => server.listen(4723, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
page.on('dialog', async d => { await d.dismiss() });
await page.goto('http://127.0.0.1:4723/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const walkTo = async (getT, ms=20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await page.evaluate(getT); if (!s) break;
    const keys = [];
    if (s.dx > 12) keys.push('KeyD'); else if (s.dx < -12) keys.push('KeyA');
    if (s.dy > 12) keys.push('KeyS'); else if (s.dy < -12) keys.push('KeyW');
    if (!keys.length) break;
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(130);
    for (const k of keys) await page.keyboard.up(k);
  }
};
await walkTo(() => world.chassis?.taken ? null
  : { dx: world.chassis.x - world.player.x, dy: world.chassis.y - world.player.y });

// fill every socket via the real pickup + install path
await page.evaluate(() => {
  const w = world, c = w.companion, p = w.player;
  w.pack = []; c.installed = [null, null, null];
  for (const id of ['ward', 'inquiry', 'pursuit']) w.salvage.push({ x: p.x, y: p.y, frag: id });
});
await page.waitForTimeout(500);
const filled = await page.evaluate(() => {
  const c = world.companion;
  (function(){
      var fit=function(f){for(var i=0;i<c.installed.length;i++){if(c.installed[i])continue;if(f.shape==='aux'&&i<c.body.sockets)continue;return i}return -1};
      var keep=[];while(world.pack.length){var f=world.pack.shift();var s=fit(f);if(s<0){keep.push(f);continue}c.install(f,s)}
      world.pack.push.apply(world.pack,keep);
    })()
  c.recompute();
  return { frags: c.liveFragments.map(f=>f.name), empty: c.emptySockets,
           loyalty: +c.loyalty.toFixed(2), curiosity: +c.curiosity.toFixed(2) };
});
console.log('full companion:', JSON.stringify(filled));

// === 1 · can you get one back out, through the UI? ===
await page.keyboard.press('KeyI'); await page.waitForTimeout(500);
const slotsBefore = await page.locator('.slot.full').count();
await page.locator('.slot.full').first().click();
await page.waitForTimeout(400);
const afterPull = await page.evaluate(() => ({
  frags: world.companion.liveFragments.map(f=>f.name),
  empty: world.companion.emptySockets,
  pack: world.pack.map(f => ({ n: f.name, deg: +f.degradation.toFixed(2) })),
  log: world.logs[0]?.text,
}));
console.log('after clicking a full socket:', JSON.stringify(afterPull));

// === 2 · does cycling wear it to nothing? ===
const cycle = await page.evaluate(() => {
  const c = world.companion, w = world;
  // put a fresh, unworn fragment in and cycle it
  const f = w.pack.find(x => x.degradation === 0) ?? w.pack[0];
  if (!f) return { error: 'nothing to cycle' };
  const trail = [];
  let held = f;
  w.pack.splice(w.pack.indexOf(f), 1);
  for (let i = 0; i < 6; i++) {
    const slot = c.installed.indexOf(null);
    if (slot < 0) break;
    c.install(held, slot);
    const out = c.remove(slot);
    trail.push(out.destroyed ? 'DESTROYED' : +out.fragment.degradation.toFixed(2));
    if (out.destroyed) break;
    held = out.fragment;
  }
  return { name: f.name, trail };
});
console.log('cycling a fresh fragment:', JSON.stringify(cycle));

// === 3 · a LIVED-IN (worn) fragment resists ===
const lived = await page.evaluate(() => {
  const c = world.companion;
  const mk = (worn) => {
    const base = { id: 'ward', name: 'PROXIMITY WARD', kinds: ['disposition'], provenance: 'x',
                   loyalty: 0.55, caution: -0.15, shape: null, worn, degradation: 0 };
    return base;
  };
  const run = (worn) => {
    c.installed = [null, null, null];
    let f = mk(worn), n = 0;
    for (; n < 12; n++) {
      c.install(f, 0);
      const out = c.remove(0);
      if (out.destroyed) return n + 1;
      f = out.fragment;
    }
    return n;
  };
  return { wild: run(0), livedIn: run(1) };
});
console.log('cycles until it comes apart:', JSON.stringify(lived));

// === 4 · dispositions actually change when a piece leaves ===
const disp = await page.evaluate(() => {
  const c = world.companion;
  c.installed = [null, null, null];
  c.install({ id:'ward', name:'PROXIMITY WARD', kinds:['disposition'], provenance:'x',
              loyalty:0.55, caution:-0.15, shape:null, worn:0, degradation:0 }, 0);
  c.recompute();
  const before = +c.loyalty.toFixed(2);
  c.remove(0);
  return { before, after: +c.loyalty.toFixed(2) };
});
console.log('loyalty when the loyal piece leaves:', JSON.stringify(disp));

console.log('\n=== VERDICTS ===');
console.log('1. a filled socket can be emptied :',
  afterPull.empty === 1 && afterPull.frags.length === 2 ? `PASS (${slotsBefore} full -> 2, "${afterPull.log}")` : `FAIL (${JSON.stringify(afterPull)})`);
console.log('2. and it comes back WORN         :',
  afterPull.pack.some(p => p.deg > 0) ? `PASS (${JSON.stringify(afterPull.pack.find(p=>p.deg>0))})` : `FAIL (${JSON.stringify(afterPull.pack)})`);
console.log('3. cycling wears it to nothing    :',
  cycle.trail?.includes('DESTROYED') ? `PASS (${cycle.trail.join(' -> ')})` : `FAIL (${JSON.stringify(cycle.trail)})`);
console.log('4. 🚨 a lived-in one survives longer:',
  lived.livedIn > lived.wild ? `PASS (wild dies after ${lived.wild} cycles, lived-in after ${lived.livedIn})`
                             : `FAIL (wild ${lived.wild}, lived-in ${lived.livedIn} ... worn resistance does nothing)`);
console.log('5. removing changes who it IS     :',
  disp.after < disp.before ? `PASS (loyalty ${disp.before} -> ${disp.after})` : `FAIL (${JSON.stringify(disp)})`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
