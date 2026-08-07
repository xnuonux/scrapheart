// IND-34j heat. "Two seconds, generous threshold, restraint rather than maths."
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
{ // freshness gate
  const newest = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((max, e) => {
    const p = path.join(dir, e.name);
    return Math.max(max, e.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs); }, 0);
  const srcT = Math.max(newest(SRC), fs.statSync(INDEX).mtimeMs);
  if (srcT > newest(ROOT)) {
    console.error('\n🚨 STALE BUILD. run `npm run build` first.\n'); process.exit(2) }
}
await new Promise(r => server.listen(4709, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4709/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.evaluate(() => { world.threats = []; world.spawnTimer = 9999 });

// hold the trigger and time the lock
await page.mouse.move(900, 400);
await page.mouse.down();
const lock = await page.evaluate(() => new Promise(res => {
  const t0 = performance.now();
  const tick = () => {
    if (world.player.overheated > 0) return res({ ms: Math.round(performance.now() - t0), heat: 1 });
    if (performance.now() - t0 > 8000) return res({ ms: null, heat: +world.player.heat.toFixed(2) });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
await page.mouse.up();
console.log('time to lock, trigger held:', lock.ms ? `${(lock.ms/1000).toFixed(2)}s` : `NEVER (peaked ${lock.heat})`);

// how long the lock lasts, and how long to fully cool
// ⚠ Sample from Node. The in-page version reported -1ms because it read `overheated`
// once per rAF starting AFTER a round trip, and the first read is not the lock start.
// Poll the remaining lock time itself, which is a value rather than an edge.
const t0 = Date.now();
let unlockMs = null, coolMs = null;
const trace = [];
while (Date.now() - t0 < 9000) {
  const s = await page.evaluate(() => ({ over: +world.player.overheated.toFixed(3),
                                         heat: +world.player.heat.toFixed(3) }));
  if (trace.length < 8) trace.push(`${Date.now()-t0}ms over=${s.over} heat=${s.heat}`);
  // ⚠ heat hits zero at ~1.2s but the LOCK is a fixed ~2s window, so breaking on heat
  // exits before the thing being measured happens. Two independent events, two records.
  if (unlockMs === null && s.over <= 0) unlockMs = Date.now() - t0;
  if (coolMs === null && s.heat <= 0.001) coolMs = Date.now() - t0;
  if (unlockMs !== null && coolMs !== null) break;
  await page.waitForTimeout(60);
}
const recover = { unlockMs: unlockMs ?? -1, coolMs };
console.log('  trace:', trace.join(' | '));
console.log('lock duration:', (recover.unlockMs/1000).toFixed(2) + 's | fully cool at:',
  recover.coolMs ? (recover.coolMs/1000).toFixed(2)+'s' : 'never');

// restraint has to WORK: burst-firing should never lock
await page.evaluate(() => { world.player.heat = 0; world.player.overheated = 0 });
let locked = false;
for (let i = 0; i < 10; i++) {
  await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
  await page.waitForTimeout(700);
  if (await page.evaluate(() => world.player.overheated > 0)) { locked = true; break }
}
const burstHeat = await page.evaluate(() => +world.player.heat.toFixed(2));
console.log('after 10 bursts of 0.9s fire / 0.7s rest: locked =', locked, '| heat', burstHeat);

console.log('\n=== VERDICTS ===');
console.log('1. the lock is REACHABLE   :', lock.ms ? `PASS (${(lock.ms/1000).toFixed(2)}s)` : 'FAIL (unreachable)');
console.log('2. ~2s, generous threshold :',
  lock.ms && lock.ms >= 1500 && lock.ms <= 2600 ? `PASS (${(lock.ms/1000).toFixed(2)}s)` : `FAIL (${lock.ms}ms)`);
console.log('3. lock is about 2s        :',
  recover.unlockMs >= 1700 && recover.unlockMs <= 2400 ? `PASS (${(recover.unlockMs/1000).toFixed(2)}s)` : `FAIL (${recover.unlockMs}ms)`);
console.log('4. restraint avoids it     :', !locked ? `PASS (10 bursts, never locked, heat settled ${burstHeat})` : 'FAIL (bursting still locks)');
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
