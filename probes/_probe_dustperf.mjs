// A/B the dust cost specifically. The profile pass had a noise floor around +-5fps
// (adding a hostile crowd "improved" fps by 4.2, which is impossible), so toggle dust
// on and off repeatedly in ONE run and take the medians instead of trusting one sample.
import { chromium, devices } from 'playwright';
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
await new Promise(r => server.listen(4721, r));
const browser = await chromium.launch();
const phone = devices['Pixel 5'];
const ctx = await browser.newContext({ ...phone, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4721/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

// a fixed worst-case scene, unchanged between samples except the dust
await page.evaluate(() => {
  world.player.x = 1400; world.player.y = 600;
  world.spawnTimer = 9999; world.bullets = [];
  for (let i = 0; i < 6; i++) world.spawnThreat();
});
await page.waitForTimeout(1200);

const sample = () => page.evaluate(async () => {
  let n = 0; const t0 = performance.now();
  await new Promise(res => { const f = () => { n++;
    if (performance.now()-t0 < 1800) requestAnimationFrame(f); else res(null) }; requestAnimationFrame(f) });
  return +(n / ((performance.now()-t0)/1000)).toFixed(1);
});
const setDust = (on) => page.evaluate((on) => {
  const p = world.player;
  world.weather = on ? { x: p.x, y: p.y, r: 460, vx: 0, vy: 0, kind: 'dust',
                         strength: 1, age: 20, life: 9999 } : null;
}, on);

const off = [], on = [];
for (let i = 0; i < 5; i++) {
  await setDust(false); await page.waitForTimeout(400); off.push(await sample());
  await setDust(true);  await page.waitForTimeout(400); on.push(await sample());
}
const med = a => [...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
console.log('clear air samples:', off.join(' '), ' median', med(off));
console.log('in dust   samples:', on.join(' '),  ' median', med(on));
const cost = med(off) - med(on);
console.log('\ndust costs', cost.toFixed(1), 'fps (was ~19 with 5 bands)');
const bands = await page.evaluate(() => matchMedia('(pointer:coarse)').matches);
console.log('coarse pointer (so 1 band):', bands);

console.log('\n=== VERDICTS ===');
console.log('1. dust costs under 6fps :', cost < 6 ? `PASS (${cost.toFixed(1)}fps)` : `FAIL (${cost.toFixed(1)}fps)`);
console.log('2. playable in the worst case:', med(on) >= 24 ? `PASS (${med(on)}fps against a 30 cap)` : `FAIL (${med(on)}fps)`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
