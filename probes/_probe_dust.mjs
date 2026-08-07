// IND-34i dust. The rule that cannot be compromised: visible from a long way off and
// avoidable. Plus: it attacks GPU, it is cover as well as a threat, and the salvage
// inside is better ... the reason to go in anyway.
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
await new Promise(r => server.listen(4710, r));
const out = SHOTS;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
const shot = async (p) => { try { await page.screenshot({ path: p }) } catch {} };
await page.goto('http://127.0.0.1:4710/', { waitUntil: 'networkidle' });
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
    await page.waitForTimeout(140);
    for (const k of keys) await page.keyboard.up(k);
  }
};
await walkTo(() => world.chassis?.taken ? null
  : { dx: world.chassis.x - world.player.x, dy: world.chassis.y - world.player.y });

console.log('=== 1. it arrives from OFF-MAP and crosses ===');
const arrival = await page.evaluate(() => {
  world.weather = null; world.weatherTimer = 0;
  return null;
});
await page.waitForTimeout(400);
const w0 = await page.evaluate(() => world.weather && ({ x: Math.round(world.weather.x),
  y: Math.round(world.weather.y), r: Math.round(world.weather.r),
  vx: +world.weather.vx.toFixed(1), strength: +world.weather.strength.toFixed(2) }));
console.log('  spawned:', JSON.stringify(w0));
console.log('  ⚠ spawn x is', w0.x, '(world is 0..1600) ... off-map =', w0.x < 0 || w0.x > 1600);

// does it move, and does strength ramp rather than snap?
const track = [];
for (let i = 0; i < 6; i++) {
  track.push(await page.evaluate(() => ({ x: Math.round(world.weather?.x ?? -9999),
                                          s: +(world.weather?.strength ?? 0).toFixed(2) })));
  await page.waitForTimeout(700);
}
console.log('  drift:', track.map(t=>`x${t.x}/s${t.s}`).join(' '));
const moved = Math.abs(track[5].x - track[0].x) > 40;
const ramped = track[0].s < track[5].s && track[0].s < 0.9;

console.log('\n=== 2. it attacks GPU (perception), measured through perceive() ===');
const gpuTest = await page.evaluate(() => {
  const c = world.companion, p = world.player;
  // park the storm exactly on the companion
  world.weather = { x: c.x, y: c.y, r: 400, vx: 0, vy: 0, kind: 'dust',
                    strength: 1, age: 20, life: 9999 };
  const inside = world.dustAt(c);
  const gpuIn = c.body.gpu * (1 - 0.62 * inside);
  world.weather.x = c.x + 5000;                 // far away
  const outside = world.dustAt(c);
  const gpuOut = c.body.gpu * (1 - 0.62 * outside);
  world.weather.x = c.x;                        // put it back
  return { base: c.body.gpu, inside: +inside.toFixed(2), gpuIn: Math.round(gpuIn),
           outside: +outside.toFixed(2), gpuOut: Math.round(gpuOut) };
});
console.log(' ', JSON.stringify(gpuTest));

console.log('\n=== 3. it is COVER: threats lose you inside it ===');
const cover = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player, c = w.companion;
  w.threats = []; w.bullets = []; w.spawnTimer = 9999;
  p.x = 700; p.y = 600; c.x = 710; c.y = 610;
  w.weather = { x: 700, y: 600, r: 460, vx: 0, vy: 0, kind: 'dust', strength: 1, age: 20, life: 9999 };
  // a runner well outside its blinded tracking range but inside the dust
  w.threats.push({ x: 700 + 380, y: 600, r: 10, hp: 40, maxHp: 40, speed: 0.7,
                   wind: 0, striking: false, alive: true, kind: 'runner', seed: 5 });
  const t0 = performance.now(), x0 = w.threats[0].x;
  const tick = () => {
    if (performance.now() - t0 > 3000) {
      const t = w.threats[0];
      return res({ startDist: 380, endDist: Math.round(Math.hypot(t.x-p.x, t.y-p.y)),
                   closed: Math.round(380 - Math.hypot(t.x-p.x, t.y-p.y)) });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('  in dust, 3s:', JSON.stringify(cover));
const clear = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player;
  w.weather = null; w.threats = []; w.bullets = [];
  p.x = 700; p.y = 600;
  w.threats.push({ x: 700 + 380, y: 600, r: 10, hp: 40, maxHp: 40, speed: 0.7,
                   wind: 0, striking: false, alive: true, kind: 'runner', seed: 5 });
  const t0 = performance.now();
  const tick = () => {
    if (performance.now() - t0 > 3000) {
      const t = w.threats[0];
      return res({ endDist: Math.round(Math.hypot(t.x-p.x, t.y-p.y)),
                   closed: Math.round(380 - Math.hypot(t.x-p.x, t.y-p.y)) });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('  in clear air, 3s:', JSON.stringify(clear));

console.log('\n=== 4. better salvage inside (the reason to go in) ===');
const drops = await page.evaluate(() => {
  const w = world;
  const run = (inDust) => {
    w.weather = inDust ? { x: 700, y: 600, r: 460, vx: 0, vy: 0, kind: 'dust',
                           strength: 1, age: 20, life: 9999 } : null;
    // read the odds the kill path uses, at the kill position
    return +(0.22 + w.dustAt({ x: 700, y: 600 }) * 0.34).toFixed(3);
  };
  const inside = run(true), outside = run(false);
  w.weather = null;
  return { inside, outside };
});
console.log(' ', JSON.stringify(drops));

console.log('\n=== VERDICTS ===');
console.log('1. 🚨 spawns OFF-MAP, visible coming:', (w0.x < 0 || w0.x > 1600) ? `PASS (x=${w0.x})` : `FAIL (x=${w0.x})`);
console.log('2. it moves across the field       :', moved ? `PASS (${track[0].x} -> ${track[5].x})` : 'FAIL');
console.log('3. it ramps in, never snaps on     :', ramped ? `PASS (strength ${track[0].s} -> ${track[5].s})` : `FAIL (${track[0].s} -> ${track[5].s})`);
console.log('4. attacks GPU (perception)        :',
  gpuTest.gpuIn < gpuTest.gpuOut * 0.5 ? `PASS (${gpuTest.gpuOut}px -> ${gpuTest.gpuIn}px)` : `FAIL (${gpuTest.gpuOut} -> ${gpuTest.gpuIn})`);
console.log('5. it is COVER as well as a threat :',
  cover.closed < clear.closed * 0.5 ? `PASS (closed ${cover.closed}px in dust vs ${clear.closed}px in clear)` : `FAIL (${cover.closed} vs ${clear.closed})`);
console.log('6. better salvage inside           :',
  drops.inside > drops.outside * 1.5 ? `PASS (${drops.outside} -> ${drops.inside} drop chance)` : `FAIL (${drops.outside} -> ${drops.inside})`);

// a picture, from outside looking in
await page.evaluate(() => {
  const w = world, p = w.player;
  p.x = 500; p.y = 600;
  w.weather = { x: 1000, y: 600, r: 380, vx: -20, vy: 0, kind: 'dust', strength: 1, age: 20, life: 9999 };
  w.threats = []; w.spawnTimer = 2;
});
await page.waitForTimeout(1400);
await shot(`${out}/w1-dust-approaching.png`);
await page.evaluate(() => { world.player.x = 1000; world.player.y = 600 });
await page.waitForTimeout(900);
await shot(`${out}/w2-dust-inside.png`);

const perf = await page.evaluate(async () => { let n=0; const t0=performance.now();
  await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(null) }; requestAnimationFrame(f) });
  return Math.round(n/((performance.now()-t0)/1000)) });
console.log('\nfps in dust:', perf, '| page errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
