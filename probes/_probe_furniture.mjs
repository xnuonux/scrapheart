// The furniture bug. IND-34l's stopped ones share the Threat type because they are
// shootable salvage, so every `threats` filter written before they existed counted them.
//
// ⚠ The worst consequence: standing near a machine that gave up damped `investigate` to
// 12%, which means the objects that ARE the atmosphere were switching the atmosphere
// system off.
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
await new Promise(r => server.listen(4716, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4716/', { waitUntil: 'networkidle' });
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

// Park the companion beside a machine that gave up, with something worth looking at
// right there, and nothing hostile anywhere.
const r = await page.evaluate(() => new Promise(res => {
  const w = world, c = w.companion, p = w.player;
  w.weather = null; w.spawnTimer = 9999; w.bullets = [];
  w.threats = w.threats.filter(t => t.kind === 'stopped');   // ONLY furniture remains
  const s = w.threats.find(t => t.kind === 'stopped');
  const i = w.interest.find(i => !i.seen) ?? w.interest[0];
  i.seen = false;
  // put the interest point, the companion and a stopped machine all together
  i.x = s.x + 40; i.y = s.y + 40;
  p.x = s.x + 70; p.y = s.y + 70;
  c.x = s.x + 55; c.y = s.y + 55; c.warm.clear(); c.swapCd = 0;
  const t0 = performance.now();
  let investigated = 0, frames = 0, minD = 9999, fled = 0, engaged = 0;
  const tick = () => {
    frames++;
    if (c.behaviour === 'investigate') investigated++;
    if (c.behaviour === 'flee') fled++;
    if (c.behaviour === 'engage') engaged++;
    minD = Math.min(minD, Math.hypot(c.x - i.x, c.y - i.y));
    p.x = s.x + 70; p.y = s.y + 70;
    if (performance.now() - t0 > 6000) {
      return res({ frames, investigated, fled, engaged, minD: Math.round(minD),
                   stoppedNearby: w.threats.filter(t => t.kind === 'stopped'
                     && Math.hypot(t.x - c.x, t.y - c.y) < 240).length,
                   scores: { investigate: +(c.scores.investigate ?? 0).toFixed(3),
                             flee: +(c.scores.flee ?? 0).toFixed(3),
                             engage: +(c.scores.engage ?? 0).toFixed(3) } });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('companion parked beside a machine that gave up, with something to look at:');
console.log(' ', JSON.stringify(r, null, 1));

// and the handler must not charge furniture either
const h = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player;
  const s = w.threats.find(t => t.kind === 'stopped');
  w.handler = { x: p.x, y: p.y, prevX: p.x, prevY: p.y, hp: 30, alive: true, r: 6, fireCd: 0, bob: 0 };
  const b0 = w.bullets.length;
  const t0 = performance.now();
  const tick = () => {
    if (performance.now() - t0 > 3000) {
      const hd = Math.hypot(w.handler.x - s.x, w.handler.y - s.y);
      return res({ handlerToStopped: Math.round(hd),
                   handlerToPlayer: Math.round(Math.hypot(w.handler.x - p.x, w.handler.y - p.y)),
                   handlerBullets: w.bullets.filter(b => b.from === 'handler').length,
                   stoppedHp: s.hp });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('\nhandler, with only furniture nearby:', JSON.stringify(h));

console.log('\n=== VERDICTS ===');
console.log('1. furniture is nearby (setup)     :',
  r.stoppedNearby > 0 ? `PASS (${r.stoppedNearby} within 240px)` : 'FAIL (test proves nothing)');
console.log('2. 🚨 curiosity is NOT suppressed  :',
  r.investigated > 0 && r.minD < 40
    ? `PASS (investigate ${r.investigated}/${r.frames} frames, reached ${r.minD}px, score ${r.scores.investigate})`
    : `FAIL (investigate ${r.investigated}, closest ${r.minD}px, score ${r.scores.investigate})`);
console.log('3. it is not afraid of furniture   :',
  r.fled === 0 && r.scores.flee < 0.3 ? `PASS (never fled, flee score ${r.scores.flee})` : `FAIL (fled ${r.fled}, score ${r.scores.flee})`);
console.log('4. it does not attack furniture    :',
  r.engaged === 0 && r.scores.engage < 0.1 ? `PASS (never engaged, engage score ${r.scores.engage})` : `FAIL (engaged ${r.engaged}, score ${r.scores.engage})`);
console.log('5. the handler stays with YOU      :',
  h.handlerToPlayer < 80 && h.handlerBullets === 0 && h.stoppedHp === 30
    ? `PASS (${h.handlerToPlayer}px from you, fired nothing, furniture untouched)`
    : `FAIL (${JSON.stringify(h)})`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
