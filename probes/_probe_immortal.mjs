// THE IMMORTAL MACHINE CLASS. Found by dom, first session on the beast PC: the
// degree-2 warden took damage forever (its `continue` sat above its death check), the
// handler ground its hp thousands below zero, and the health bar drew backwards across
// the field. The fix is `hurtThreat`, the single damage door.
//
// The claims, tested directly:
//   1. a threat whose hp reaches 0 dies, whatever the damage source (handler fire)
//   2. THE BROKEN WARDEN DIES ... 340hp of grinding, then alive=false and a selfpres drop
//   3. the invariant: no alive threat ever holds hp <= 0, sampled every frame throughout
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(REPO, 'dist');
const SRC = join(REPO, 'src');

// ⚠ the freshness gate: a probe serving dist while src is newer measures OLD code in
// total silence. four measurement rounds were lost to exactly that once.
const newest = (dir) => {
  let t = 0;
  for (const f of fs.readdirSync(dir, { recursive: true })) {
    const p = join(dir, String(f));
    if (fs.statSync(p).isFile()) t = Math.max(t, fs.statSync(p).mtimeMs);
  }
  return t;
};
if (newest(SRC) > newest(DIST)) {
  console.error('REFUSING TO RUN: src is newer than dist. `npm run build` first.');
  process.exit(2);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(DIST, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(4733, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:4733/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

// A · handler fire alone kills a runner. The handler is the damage source dom watched
// produce the bug, so the claim is tested through its actual gun, not a shortcut.
const a = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player;
  w.weather = null; w.spawnTimer = 9999; w.bullets = [];
  // ⚠ keep the wardens: claim B needs the degree-2 one, and the first version of this
  // filter deleted its own subject before B ran. a probe that clears the stage can
  // clear the thing under test.
  w.threats = w.threats.filter(t => t.kind === 'stopped' || t.kind === 'warden');
  if (!w.handlerMet) { w.chassis && (w.chassis.taken = true); w.spawnHandler(); }
  const h = w.handler;
  p.x = 700; p.y = 400;
  h.x = 700; h.y = 590; h.alive = true;
  w.threats.push({ x: 700, y: 610, r: 10, hp: 25, maxHp: 25, speed: 0,
                   wind: 0, striking: false, alive: true, kind: 'runner', seed: 9 });
  const t0 = performance.now();
  let violations = 0;
  const tick = () => {
    p.x = 700; p.y = 400;                    // player far: the dog does the killing
    h.x = 700; h.y = 590;
    for (const t of w.threats) if (t.alive && t.hp <= 0) violations++
    const r = w.threats.find(t => t.kind === 'runner');
    if (!r || !r.alive || performance.now() - t0 > 15000) {
      return res({ dead: !r || !r.alive, ms: Math.round(performance.now() - t0), violations });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('A · handler fire alone, 25hp runner:', JSON.stringify(a));

// B · the broken warden dies. 340hp ground down by player-path bullets, exactly the
// shape of the endless fight dom watched ... except now it ends.
const b = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player;
  w.bullets = []; w.spawnTimer = 9999;
  if (w.handler) w.handler.alive = false;    // claim B is about the warden, not the dog
  const wd = w.threats.find(t => t.kind === 'warden' && t.degree === 2);
  if (!wd) return res({ found: false });
  p.x = wd.x - 120; p.y = wd.y;
  const salvage0 = w.salvage.length;
  const t0 = performance.now();
  let violations = 0, minHp = wd.hp;
  const tick = () => {
    p.x = wd.x - 120; p.y = wd.y;
    // a stream of player bullets into it ... the door is the thing under test
    if (w.bullets.length < 6 && wd.alive)
      w.bullets.push({ x: wd.x - 60, y: wd.y, vx: 400, vy: 0, life: 0.5, from: 'player' });
    for (const t of w.threats) if (t.alive && t.hp <= 0) violations++
    if (wd.alive) minHp = Math.min(minHp, wd.hp);   // the killing blow may overshoot on a corpse
    if (!wd.alive || performance.now() - t0 > 30000) {
      const drop = w.salvage.slice(salvage0).find(s => s.frag === 'selfpres');
      return res({ found: true, dead: !wd.alive, minHp: Math.round(minHp),
                   selfpres: !!drop, ms: Math.round(performance.now() - t0), violations });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
console.log('B · the broken warden, ground down:', JSON.stringify(b));

console.log('\n=== VERDICTS ===');
console.log('1. handler-source damage kills   :', a.dead ? `PASS (${a.ms}ms)` : 'FAIL (runner survived 15s of dog fire)');
console.log('2. the broken warden CAN die     :', b.found && b.dead ? `PASS (${b.ms}ms)` : `FAIL ${JSON.stringify(b)}`);
console.log('3. it drops what a warden drops  :', b.selfpres ? 'PASS (selfpres)' : 'FAIL (no selfpres in the wreckage)');
console.log('4. no alive threat ever at hp<=0 :', (a.violations + (b.violations ?? 0)) === 0 ? 'PASS (0 violations across both runs)' : `FAIL (${a.violations + b.violations} frames)`);
console.log('5. hp never ground negative while alive:', (b.minHp ?? -1) >= 0 ? `PASS (floor ${b.minHp})` : `FAIL (reached ${b.minHp})`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
