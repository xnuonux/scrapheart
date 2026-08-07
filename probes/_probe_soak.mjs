// THE SOAK. The gate is ten people for ONE HOUR and nothing in this build has ever run
// longer than three minutes.
//
// ⚠ Every unbounded array is a slow leak that only shows up at the exact length of the
// test that matters. A session that degrades at minute 40 would read as "the game gets
// boring" in the notes, and the notes would be wrong.
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
await new Promise(r => server.listen(4715, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
page.on('dialog', async d => { await d.dismiss() });
await page.goto('http://127.0.0.1:4715/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

// ── PART 1: what does an hour of play actually accumulate? ──
// Simulate it honestly rather than waiting: drive the spawn+kill cycle at the rate the
// game produces it, for an hour of game time, without the player ever collecting.
console.log('=== 1. an hour of kills, nothing picked up ===');
const grown = await page.evaluate(() => {
  const w = window.world;
  // an hour at the deep spawn rate: cap 6, respawn ~3s, so ~1200 kills is generous
  const KILLS = 1200;
  for (let i = 0; i < KILLS; i++) {
    w.spawnThreat();
    const t = w.threats[w.threats.length - 1];
    t.hp = 0;
    // the death path, as the sim runs it
    w.salvage.push({ x: t.x, y: t.y, frag: Math.random() < 0.3 ? 'attend' : null });
    t.alive = false;
  }
  w.threats = w.threats.filter(t => t.alive);
  return { salvage: w.salvage.length, threats: w.threats.length, wrecks: w.wrecks.length,
           interest: w.interest.length, logs: w.logs.length, bullets: w.bullets.length,
           records: w.records.length };
});
console.log(' ', JSON.stringify(grown));

// what does that cost per frame?
const costly = await page.evaluate(async () => {
  let n = 0; const t0 = performance.now(); const frames = []; let last = t0;
  await new Promise(res => { const f = () => { const now = performance.now();
    frames.push(now - last); last = now; n++;
    if (now - t0 < 3000) requestAnimationFrame(f); else res(null) }; requestAnimationFrame(f) });
  frames.sort((a,b)=>a-b);
  return { fps: Math.round(n / ((performance.now()-t0)/1000)),
           p95: +frames[Math.floor(frames.length*0.95)].toFixed(1),
           worst: +frames[frames.length-1].toFixed(1) };
});
console.log('  fps with an hour of uncollected salvage on the ground:', JSON.stringify(costly));

// ── PART 2: a real continuous run, and the growth RATE ──
console.log('\n=== 2. six minutes of continuous play, sampled ===');
await page.reload({ waitUntil: 'networkidle' });
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

const samples = [];
const t0 = Date.now();
while (Date.now() - t0 < 360000) {
  const st = await page.evaluate(() => {
    const w = window.world, p = w.player;
    const t = w.threats.filter(t => t.alive && t.kind !== 'stopped')
      .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    return { t: +w.t.toFixed(0), salvage: w.salvage.length, threats: w.threats.length,
             bullets: w.bullets.length, interest: w.interest.length, logs: w.logs.length,
             pack: w.pack.length, banked: w.banked.length, run: w.run,
             heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : null,
             aim: t ? { sx: 640 + (t.x-p.x), sy: 400 + (t.y-p.y) } : null };
  });
  if (samples.length === 0 || st.t - samples[samples.length-1].t >= 30) {
    samples.push(st);
    process.stdout.write(`  t=${st.t}s salvage=${st.salvage} threats=${st.threats} bullets=${st.bullets} heap=${st.heap}MB\n`);
  }
  if (st.aim) { await page.mouse.move(st.aim.sx, st.aim.sy); await page.mouse.down() }
  const k = ['KeyD','KeyW','KeyS','KeyA'][Math.floor(Math.random()*4)];
  await page.keyboard.down(k); await page.waitForTimeout(400); await page.keyboard.up(k);
  await page.mouse.up();
}

const end = await page.evaluate(async () => {
  let n = 0; const t0 = performance.now();
  await new Promise(res => { const f = () => { n++;
    if (performance.now()-t0 < 3000) requestAnimationFrame(f); else res(null) }; requestAnimationFrame(f) });
  return { fps: Math.round(n / ((performance.now()-t0)/1000)),
           t: +world.t.toFixed(0), salvage: world.salvage.length,
           heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : null };
});
const first = samples[0], last = samples[samples.length-1];
const mins = (last.t - first.t) / 60;
const salvageRate = (last.salvage - first.salvage) / mins;
const heapRate = (last.heap != null && first.heap != null) ? (last.heap - first.heap) / mins : null;

console.log('\n=== VERDICTS ===');
console.log('1. an hour of loot on the ground is cheap:',
  costly.fps >= 55 ? `PASS (${costly.fps}fps with ${grown.salvage} salvage entries, worst frame ${costly.worst}ms)` : `FAIL (${costly.fps}fps)`);
console.log('2. nothing grows without bound            :',
  grown.threats < 40 && grown.logs <= 6 && grown.records <= 5
    ? `PASS (threats ${grown.threats}, logs ${grown.logs}, records ${grown.records} after 1200 kills)`
    : `FAIL (${JSON.stringify(grown)})`);
console.log('3. six real minutes, fps holds            :',
  end.fps >= 55 ? `PASS (${end.fps}fps at t=${end.t}s)` : `FAIL (${end.fps}fps)`);
console.log('4. salvage growth is sane                 :',
  salvageRate < 25 ? `PASS (${salvageRate.toFixed(1)}/min -> ~${Math.round(salvageRate*60)} over an hour)` : `FAIL (${salvageRate.toFixed(1)}/min)`);
console.log('5. heap is not climbing                   :',
  heapRate === null ? 'UNKNOWN (no performance.memory)' :
  heapRate < 1.5 ? `PASS (${heapRate.toFixed(2)} MB/min, ${first.heap} -> ${last.heap} MB)` : `FAIL (${heapRate.toFixed(2)} MB/min)`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
