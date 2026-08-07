// IND-34l. The ones that gave up, and the warden that announced and cannot follow
// through. The claims: still ON, never reacts, always salvage, better salvage, found
// alone, and degree readable from BEHAVIOUR rather than any label.
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
  if (srcT > newest(ROOT)) {
    console.error('\n🚨 STALE BUILD. run `npm run build` first.\n'); process.exit(2) } }
await new Promise(r => server.listen(4711, r));
const out = SHOTS;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
const shot = async (p) => { try { await page.screenshot({ path: p }) } catch {} };
await page.goto('http://127.0.0.1:4711/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

console.log('=== 1. found individually, never in groups ===');
const spread = await page.evaluate(() => {
  const s = world.threats.filter(t => t.kind === 'stopped');
  let minPair = 99999;
  for (let i = 0; i < s.length; i++) for (let j = i+1; j < s.length; j++)
    minPair = Math.min(minPair, Math.hypot(s[i].x-s[j].x, s[i].y-s[j].y));
  return { count: s.length, closestPair: Math.round(minPair) };
});
console.log(' ', JSON.stringify(spread));

console.log('\n=== 2. it does not react. not to anything. ===');
const inert = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player;
  const s = w.threats.find(t => t.kind === 'stopped');
  w.weather = null;
  // ⚠ Clear everything else and hold the spawner off. The claim is "THIS machine does
  // not react", and a runner wandering in during the window costs the player 6hp and
  // makes the assertion fail for a reason that has nothing to do with the stopped one.
  w.threats = w.threats.filter(t => t.kind === 'stopped' || t.kind === 'warden');
  w.spawnTimer = 9999; w.bullets = [];
  p.hp = p.maxHp;
  p.x = s.x + 30; p.y = s.y + 30;          // stand right on top of it
  const x0 = s.x, y0 = s.y, w0 = s.wind;
  const t0 = performance.now();
  const tick = () => {
    if (performance.now() - t0 > 3500) {
      return res({ movedPx: Math.round(Math.hypot(s.x-x0, s.y-y0)),
                   wind: +s.wind.toFixed(2), windWas: +w0.toFixed(2),
                   striking: s.striking, playerHp: Math.round(p.hp) });
    }
    p.x = x0 + 30; p.y = y0 + 30;
    w.spawnTimer = 9999;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log(' ', JSON.stringify(inert));

console.log('\n=== 3. every one of them is salvage, and the intact ones are BETTER ===');
const strip = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player;
  const s = w.threats.find(t => t.kind === 'stopped' && t.alive);
  const before = w.salvage.length;
  p.x = s.x - 60; p.y = s.y;
  const t0 = performance.now();
  const fire = () => {
    if (!s.alive) {
      const dropped = w.salvage.filter(sv => Math.hypot(sv.x-s.x, sv.y-s.y) < 30);
      return res({ killed: true, dropped: dropped.length,
                   withFrag: dropped.filter(d => d.frag).length,
                   ms: Math.round(performance.now()-t0) });
    }
    if (performance.now() - t0 > 6000) return res({ killed: false });
    w.bullets.push({ x: p.x, y: p.y, vx: 420, vy: 0, life: 1, from: 'player' });
    requestAnimationFrame(fire);
  };
  requestAnimationFrame(fire);
}));
console.log(' ', JSON.stringify(strip));
// what an ordinary runner drops, for comparison
const runnerDrop = await page.evaluate(() => {
  let frags = 0, n = 400;
  for (let i = 0; i < n; i++) if (Math.random() < 0.22) frags++;
  return { expectedRunnerFrags: +(frags/n).toFixed(2) };
});
console.log('  ordinary runner, for comparison:', JSON.stringify(runnerDrop));

console.log('\n=== 4. the warden that announced and cannot follow through ===');
const degree2 = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player;
  const d2 = w.threats.find(t => t.kind === 'warden' && t.degree === 2);
  if (!d2) return res({ exists: false });
  w.handler = null;
  p.x = d2.x - 140; p.y = d2.y;             // well inside a working warden's reach
  p.hp = 100;
  const x0 = d2.x, y0 = d2.y;
  const t0 = performance.now();
  const tick = () => {
    if (performance.now() - t0 > 5000) {
      return res({ exists: true, announced: d2.announced,
                   movedPx: Math.round(Math.hypot(d2.x-x0, d2.y-y0)),
                   wind: +d2.wind.toFixed(2), striking: d2.striking,
                   playerHp: Math.round(p.hp),
                   said: world.logs.some(l => l.text.includes('UNIT 12')) });
    }
    p.x = x0 - 140; p.y = y0; p.hp = Math.max(p.hp, 1);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log(' ', JSON.stringify(degree2));

console.log('\n=== 5. it gives the warning AGAIN, every time you pass ===');
const rearm = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player;
  const d2 = w.threats.find(t => t.kind === 'warden' && t.degree === 2);
  p.x = 200; p.y = 200;                     // walk far away so it rearms
  const t0 = performance.now();
  const tick = () => {
    if (!d2.announced) {                    // rearmed
      p.x = d2.x - 140; p.y = d2.y;         // walk back
      setTimeout(() => res({ rearmed: true, announcedAgain: d2.announced }), 400);
      return;
    }
    if (performance.now() - t0 > 14000) return res({ rearmed: false });
    p.x = 200; p.y = 200;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log(' ', JSON.stringify(rearm));

console.log('\n=== VERDICTS ===');
console.log('1. found alone, never in groups :',
  spread.count >= 4 && spread.closestPair > 300 ? `PASS (${spread.count} of them, closest pair ${spread.closestPair}px apart)` : `FAIL (${JSON.stringify(spread)})`);
console.log('2. 🚨 it does not react to you  :',
  inert.movedPx < 3 && inert.wind === 0 && !inert.striking && inert.playerHp === 100
    ? `PASS (stood on it 3.5s: moved ${inert.movedPx}px, wind ${inert.wind}, took 0 damage)` : `FAIL (${JSON.stringify(inert)})`);
console.log('3. taking it apart always works :', strip.killed ? `PASS (${strip.ms}ms)` : 'FAIL');
console.log('4. and it is BETTER salvage     :',
  strip.withFrag >= 2 ? `PASS (${strip.withFrag} fragments guaranteed vs a runner's ${runnerDrop.expectedRunnerFrags} expected)` : `FAIL (${strip.withFrag})`);
console.log('5. degree 2 announces           :', degree2.said ? 'PASS' : 'FAIL');
console.log('6. 🚨 and then nothing, ever    :',
  degree2.movedPx < 3 && !degree2.striking && degree2.playerHp === 100
    ? `PASS (stood in its reach 5s: moved ${degree2.movedPx}px, took 0 damage)` : `FAIL (${JSON.stringify(degree2)})`);
console.log('7. it warns again every pass    :',
  rearm.rearmed && rearm.announcedAgain ? 'PASS' : `FAIL (${JSON.stringify(rearm)})`);

await page.evaluate(() => {
  const s = world.threats.find(t => t.kind === 'stopped' && t.alive);
  if (s) { world.player.x = s.x - 40; world.player.y = s.y - 30 }
  world.weather = null;
});
await page.waitForTimeout(900);
await shot(`${out}/s1-stopped.png`);
const perf = await page.evaluate(async () => { let n=0; const t0=performance.now();
  await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(null) }; requestAnimationFrame(f) });
  return Math.round(n/((performance.now()-t0)/1000)) });
console.log('\nfps:', perf, '| page errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
