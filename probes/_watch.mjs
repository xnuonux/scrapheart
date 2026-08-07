// Sit and watch it. Every mechanic here has been verified in isolation and nobody has
// looked at the thing running for more than a screenshot at a time.
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
await new Promise(r => server.listen(4717, r));
const out = SHOTS;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4717/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const shot = async (n) => { try { await page.screenshot({ path: `${out}/${n}.png` }) } catch {} };

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

// 1 · the very first thing anyone sees
await shot('01-open');
console.log('01 the opening, before anyone has moved');

// 2 · the chassis, before it is anything
await walkTo(() => {
  const ch = world.chassis; if (!ch || ch.taken) return null;
  const d = Math.hypot(ch.x-world.player.x, ch.y-world.player.y);
  return d < 70 ? null : { dx: ch.x-world.player.x, dy: ch.y-world.player.y };
});
await shot('02-chassis');
console.log('02 standing over the opened bay');

// 3 · it stands up
await walkTo(() => world.chassis?.taken ? null
  : { dx: world.chassis.x - world.player.x, dy: world.chassis.y - world.player.y });
await page.waitForTimeout(500);
await shot('03-stands-up');
console.log('03 it stands up');

// 4 · the pack, open
await page.keyboard.press('KeyI'); await page.waitForTimeout(600);
await shot('04-pack');
await page.keyboard.press('KeyI'); await page.waitForTimeout(300);
console.log('04 the pack panel');

// 5 · a fight
await page.evaluate(() => { world.spawnTimer = 0; world.player.x = 900 });
await page.waitForTimeout(3500);
await page.mouse.move(820, 360); await page.mouse.down();
await page.waitForTimeout(900);
await shot('05-fight');
await page.mouse.up();
console.log('05 mid-fight');

// 6 · badly hurt ... the thing the gate measures
await page.evaluate(() => { world.companion.hp = world.companion.maxHp * 0.12 });
await page.waitForTimeout(700);
await shot('06-badly-hurt');
console.log('06 the companion badly hurt');

// 7 · mending it
await page.evaluate(() => {
  const c = world.companion, p = world.player;
  c.x = p.x + 12; c.y = p.y + 12; c.prevX = c.x; c.prevY = c.y;
});
await page.keyboard.down('KeyE'); await page.waitForTimeout(900);
await shot('07-mending');
await page.keyboard.up('KeyE');
console.log('07 mending it');

// 8 · the handler
await page.evaluate(() => { world.t = 60; world.spawnHandler() });
await page.waitForTimeout(900);
await shot('08-handler');
console.log('08 the handler arrives');

// 9 · dust rolling in, seen from outside
await page.evaluate(() => {
  const p = world.player;
  world.weather = { x: p.x + 620, y: p.y, r: 400, vx: -20, vy: 0, kind: 'dust',
                    strength: 1, age: 20, life: 9999 };
});
await page.waitForTimeout(900);
await shot('09-dust-coming');
console.log('09 dust on the horizon');

// 10 · inside it
await page.evaluate(() => { world.weather.x = world.player.x });
await page.waitForTimeout(900);
await shot('10-dust-inside');
console.log('10 inside the dust');

// 11 · a machine that gave up
await page.evaluate(() => {
  world.weather = null;
  const s = world.threats.find(t => t.kind === 'stopped');
  world.player.x = s.x - 50; world.player.y = s.y - 30;
  world.companion.x = s.x - 30; world.companion.y = s.y - 10;
});
await page.waitForTimeout(900);
await shot('11-gave-up');
console.log('11 a machine that gave up');

// 12 · the warden
await page.evaluate(() => {
  const p = world.player;
  world.threats.push({ x: p.x + 200, y: p.y, r: 26, hp: 340, maxHp: 340, speed: 0.42,
    wind: 1.2, striking: true, alive: true, kind: 'warden', seed: 7, announced: true, degree: 1 });
});
await page.waitForTimeout(500);
await shot('12-warden');
console.log('12 the warden, winding up');

// 13 · death
await page.evaluate(() => { world.player.hp = -1 });
await page.waitForTimeout(700);
await shot('13-death');
console.log('13 you die here');

// 14 · it waiting where you fell
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const q = world.waiting; if (q) { world.player.x = q.x - 90; world.player.y = q.y - 60 }
});
await page.waitForTimeout(600);
await shot('14-waiting');
console.log('14 it is still standing where you fell');

console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
