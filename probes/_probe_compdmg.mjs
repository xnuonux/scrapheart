// Can the companion be damaged at all? The gate probe went from minHp 2% to a flat 100%.
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
await new Promise(r => server.listen(4718, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4718/', { waitUntil: 'networkidle' });
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

// A: a runner parked ON the companion, player far away so the companion is nearest.
const melee = await page.evaluate(() => new Promise(res => {
  const w = world, c = w.companion, p = w.player;
  w.weather = null; w.spawnTimer = 9999; w.bullets = [];
  w.threats = w.threats.filter(t => t.kind === 'stopped');
  c.x = 700; c.y = 600; c.prevX = 700; c.prevY = 600; c.hp = c.maxHp;
  p.x = 1100; p.y = 600;                      // far, so the companion is the near target
  w.threats.push({ x: 715, y: 600, r: 10, hp: 9999, maxHp: 9999, speed: 0,
                   wind: 0, striking: false, alive: true, kind: 'runner', seed: 4 });
  const hp0 = c.hp;
  const t0 = performance.now();
  const tick = () => {
    c.x = 700; c.y = 600;                     // pin it in reach
    p.x = 1100; p.y = 600;
    if (c.hp < hp0 || performance.now() - t0 > 6000) {
      return res({ hp0, hp: Math.round(c.hp), took: Math.round(hp0 - c.hp),
                   ms: Math.round(performance.now() - t0),
                   beh: c.behaviour, threatWind: +w.threats.find(t=>t.kind==='runner').wind.toFixed(2) });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('A · runner parked on the companion, player 400px away:');
console.log(' ', JSON.stringify(melee));

// B: a caster shot aimed straight at it
const shot = await page.evaluate(() => new Promise(res => {
  const w = world, c = w.companion, p = w.player;
  w.threats = w.threats.filter(t => t.kind === 'stopped'); w.bullets = [];
  c.x = 700; c.y = 600; c.hp = c.maxHp;
  p.x = 1100; p.y = 600;
  const hp0 = c.hp;
  w.bullets.push({ x: 650, y: 600, vx: 200, vy: 0, life: 2, from: 'threat' });
  const t0 = performance.now();
  const tick = () => {
    c.x = 700; c.y = 600;
    if (c.hp < hp0 || performance.now() - t0 > 3000) {
      return res({ hp0, hp: Math.round(c.hp), took: Math.round(hp0 - c.hp),
                   bulletsLeft: w.bullets.length });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('B · a caster shot straight at it:');
console.log(' ', JSON.stringify(shot));

console.log('\n=== VERDICTS ===');
console.log('1. melee can hurt the companion :', melee.took > 0 ? `PASS (took ${melee.took} in ${melee.ms}ms)` : `FAIL (untouched after 6s, wind ${melee.threatWind}, behaviour ${melee.beh})`);
console.log('2. gunfire can hurt it          :', shot.took > 0 ? `PASS (took ${shot.took})` : `FAIL (bullet passed through, ${shot.bulletsLeft} left in flight)`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
