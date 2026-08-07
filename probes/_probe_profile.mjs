// WHERE does the frame go? Cross-run fps numbers are contaminated (the clear-air
// baseline drifted 34 -> 28 across the session while nothing touching clear air
// changed), so measure the pieces WITHIN one run against each other instead.
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
await new Promise(r => server.listen(4720, r));
const browser = await chromium.launch();
const phone = devices['Pixel 5'];
const ctx = await browser.newContext({ ...phone, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4720/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const measure = async (label, setup) => {
  await page.evaluate(setup);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    let n = 0; const t0 = performance.now();
    await new Promise(res => { const f = () => { n++;
      if (performance.now()-t0 < 2600) requestAnimationFrame(f); else res(null) }; requestAnimationFrame(f) });
    return { fps: +(n / ((performance.now()-t0)/1000)).toFixed(1),
             threats: world.threats.filter(t=>t.alive).length,
             salvage: world.salvage.length, wrecks: world.wrecks.length };
  });
  console.log(`  ${label.padEnd(38)} ${String(r.fps).padStart(5)}fps   threats ${r.threats} salvage ${r.salvage}`);
  return r.fps;
};

console.log('=== throttled Pixel 5, one run, pieces compared against each other ===');
const base = await measure('deep, no dust, no extras', () => {
  world.weather = null; world.player.x = 1400; world.player.y = 600;
  world.threats = []; world.spawnTimer = 9999; world.bullets = [];
});
const wrecksOff = await measure('same, but wrecks not drawn', () => {
  world.__wrecksBackup = world.wrecks; world.wrecks = [];
});
await page.evaluate(() => { world.wrecks = world.__wrecksBackup });
const withStopped = await measure('+ the 6 stopped ones', () => {
  world.threats = world.__stoppedBackup ?? [];
  if (!world.__stoppedBackup) {
    for (let i = 0; i < 6; i++) world.threats.push({ x: 1300 + i*40, y: 500 + i*30, r: 11,
      hp: 30, maxHp: 30, speed: 0, wind: 0, striking: false, alive: true, kind: 'stopped', seed: i*97 });
    world.__stoppedBackup = world.threats.slice();
  }
});
const withCrowd = await measure('+ a full hostile crowd', () => {
  world.spawnTimer = 0;
  for (let i = 0; i < 6; i++) world.spawnThreat();
});
const withDust = await measure('+ dust on top of all of it', () => {
  const p = world.player;
  world.weather = { x: p.x, y: p.y, r: 460, vx: 0, vy: 0, kind: 'dust', strength: 1, age: 20, life: 9999 };
});
const withSalvage = await measure('+ an hour of salvage on the ground', () => {
  for (let i = 0; i < 380; i++) world.salvage.push({ x: 900 + Math.random()*700,
    y: 200 + Math.random()*800, frag: i % 4 === 0 ? 'attend' : null });
});

console.log('\n=== the cost of each piece, same run, same machine ===');
console.log(`  wrecks (340 procedural sprites) : ${(wrecksOff - base).toFixed(1)}fps  ${wrecksOff > base ? '<-- removing them GAINS this' : ''}`);
console.log(`  the 6 stopped ones              : ${(withStopped - base).toFixed(1)}fps`);
console.log(`  a full hostile crowd            : ${(withCrowd - withStopped).toFixed(1)}fps`);
console.log(`  dust                            : ${(withDust - withCrowd).toFixed(1)}fps`);
console.log(`  380 salvage on the ground       : ${(withSalvage - withDust).toFixed(1)}fps`);
console.log(`  WORST CASE total                : ${withSalvage}fps against a 30fps cap`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
