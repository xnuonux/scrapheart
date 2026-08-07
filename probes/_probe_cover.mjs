// COVERING. IND-34c: "when you retreat, a brave companion advances", which the doc calls
// the entire emotional engine of this game.
//
// 🚨 `p.retreating` was assigned `false` every frame and never once set true anywhere,
// so `s.cover` scored zero on every frame since the first commit. This is the probe that
// would have caught that, and it did not exist.
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
await new Promise(r => server.listen(4719, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4719/', { waitUntil: 'networkidle' });
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

// give it loyalty, the way a player would: ATTENDANCE is the first fragment in the trail
await page.evaluate(() => {
  const w = world, c = w.companion, p = w.player;
  w.pack = []; c.installed = [null, null, null];
  w.salvage.push({ x: p.x, y: p.y, frag: 'gait' });
  w.salvage.push({ x: p.x, y: p.y, frag: 'ward' });     // PROXIMITY WARD, loyalty 0.55
});
await page.waitForTimeout(500);
const built = await page.evaluate(() => {
  const c = world.companion;
  (function(){
      var fit=function(f){for(var i=0;i<c.installed.length;i++){if(c.installed[i])continue;if(f.shape==='aux'&&i<c.body.sockets)continue;return i}return -1};
      var keep=[];while(world.pack.length){var f=world.pack.shift();var s=fit(f);if(s<0){keep.push(f);continue}c.install(f,s)}
      world.pack.push.apply(world.pack,keep);
    })()
  c.recompute();
  return { frags: c.liveFragments.map(f=>f.name), loyalty: +c.loyalty.toFixed(2) };
});
console.log('built a loyal machine:', JSON.stringify(built));
// 🚨 ASSERT THE SETUP. The fragments arrive via the real pickup path, which is timing
// dependent, and when it silently did not take this probe measured a STARTER machine and
// correctly reported that it never covers ... which reads as the feature being broken.
// ⚠ A probe that does not verify its own preconditions measures whatever it happened
// to get, and then blames the code.
if (built.loyalty < 0.5) {
  console.error(`\n🚨 SETUP FAILED: loyalty ${built.loyalty}, expected > 0.5.`);
  console.error('   The pickup did not land, so there is no loyal machine to test.\n');
  await browser.close(); server.close(); process.exit(3);
}

// A · walk TOWARD a threat: not retreating
const toward = await page.evaluate(() => new Promise(res => {
  const w = world, p = w.player, c = w.companion;
  w.weather = null; w.spawnTimer = 9999; w.bullets = [];
  w.threats = w.threats.filter(t => t.kind === 'stopped');
  p.x = 700; p.y = 600; c.x = 690; c.y = 610;
  w.threats.push({ x: 900, y: 600, r: 10, hp: 9999, maxHp: 9999, speed: 0,
                   wind: 0, striking: false, alive: true, kind: 'runner', seed: 4 });
  let sawRetreat = 0, frames = 0;
  const t0 = performance.now();
  const tick = () => {
    frames++;
    if (p.retreating) sawRetreat++;
    if (performance.now() - t0 > 1500) return res({ frames, sawRetreat });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
// drive INTO the threat (it is east of us)
await page.keyboard.down('KeyD'); await page.waitForTimeout(1200);
const towardFlag = await page.evaluate(() => world.player.retreating);
await page.keyboard.up('KeyD');
console.log('walking TOWARD it   -> retreating =', towardFlag);

// B · walk AWAY: retreating, and a loyal companion should advance
await page.evaluate(() => {
  const w = world, p = w.player, c = w.companion;
  p.x = 700; p.y = 600;
  w.threats = w.threats.filter(t => t.kind === 'stopped');
  // ⚠ speed 0.7, because real runners CHASE. A static threat let the player sprint
  // 500px clear in three seconds, which put it outside both the 330px retreat radius
  // and the 400px cover radius, and the probe then reported that a loyal machine never
  // covers. It was measuring a situation the game does not produce.
  w.threats.push({ x: 860, y: 600, r: 10, hp: 9999, maxHp: 9999, speed: 0.7,
                   wind: 0, striking: false, alive: true, kind: 'runner', seed: 4 });
  c.x = 690; c.y = 610; c.warm.clear(); c.swapCd = 0;
});
await page.keyboard.down('KeyA');
const away = { flag: 0, cover: 0, frames: 0, compAdvancedPx: 0, coverScore: 0 };
const c0 = await page.evaluate(() => ({ cx: world.companion.x }));
const warmTrace = [];
// ⚠ 60 samples, not 30. `cover` must be swapped INTO the RAM warm set before it can be
// chosen, and a RAM-2 machine takes about a second to load it. Sampling for 1.8s was a
// race against the reload window, which is why this passed and failed on identical code.
// The lag is the mechanic; the probe just has to outlast it.
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate(() => ({
    retreating: world.player.retreating, beh: world.companion.behaviour,
    cx: world.companion.x, px: world.player.x,
    warm: [...world.companion.warm].join('+'),
    cover: +(world.companion.scores.cover ?? 0).toFixed(3) }));
  if (warmTrace.length < 12) warmTrace.push(`${s.beh}[${s.warm}]`);
  away.frames++;
  if (s.retreating) away.flag++;
  if (s.beh === 'cover') away.cover++;
  away.coverScore = Math.max(away.coverScore, s.cover);
  away.compAdvancedPx = Math.round(s.cx - c0.cx);
  await page.waitForTimeout(60);
}
await page.keyboard.up('KeyA');
console.log('walking AWAY        ->', JSON.stringify(away));
console.log('  warm set over time:', warmTrace.join(' '));

// C · does the retreat ring actually draw now?
const ring = await page.evaluate(() => {
  const p = world.player;
  return { retreating: p.retreating };
});

// D · the CONTROL: a starter machine must NOT cover. bravery is built, not given.
await page.evaluate(() => {
  const w = world, c = w.companion, p = w.player;
  c.installed = [null, null, null];
  c.install({ id:'gait', name:'GAIT REGULATOR', kinds:['function'], provenance:'x',
              grants:[], shape:null, worn:0, degradation:0 }, 0);
  c.recompute(); c.warm.clear(); c.swapCd = 0;
  p.x = 700; p.y = 600; c.x = 690; c.y = 610;
  w.threats = w.threats.filter(t => t.kind === 'stopped');
  // ⚠ speed 0.7, because real runners CHASE. A static threat let the player sprint
  // 500px clear in three seconds, which put it outside both the 330px retreat radius
  // and the 400px cover radius, and the probe then reported that a loyal machine never
  // covers. It was measuring a situation the game does not produce.
  w.threats.push({ x: 860, y: 600, r: 10, hp: 9999, maxHp: 9999, speed: 0.7,
                   wind: 0, striking: false, alive: true, kind: 'runner', seed: 4 });
});
await page.keyboard.down('KeyA');
const timid = { cover: 0, peak: 0, loyalty: 0 };
for (let i = 0; i < 25; i++) {
  const s = await page.evaluate(() => ({ beh: world.companion.behaviour,
    cover: +(world.companion.scores.cover ?? 0).toFixed(3),
    loyalty: +world.companion.loyalty.toFixed(2) }));
  if (s.beh === 'cover') timid.cover++;
  timid.peak = Math.max(timid.peak, s.cover);
  timid.loyalty = s.loyalty;
  await page.waitForTimeout(60);
}
await page.keyboard.up('KeyA');
console.log('CONTROL, a starter machine ->', JSON.stringify(timid));

console.log('\n=== VERDICTS ===');
console.log('1. walking toward is NOT retreat :', towardFlag === false ? 'PASS' : `FAIL (${towardFlag})`);
console.log('2. 🚨 walking away IS retreat    :',
  away.flag > 5 ? `PASS (${away.flag}/${away.frames} samples)` : `FAIL (${away.flag}/${away.frames} ... the flag never turns on)`);
console.log('3. cover can now score at all    :',
  away.coverScore > 0 ? `PASS (peak ${away.coverScore})` : 'FAIL (still exactly 0 ... s.cover is still dead)');
console.log('4. a loyal machine ADVANCES      :',
  away.cover > 0 || away.compAdvancedPx > 10
    ? `PASS (cover chosen ${away.cover}x, moved ${away.compAdvancedPx}px toward the threat while you fell back)`
    : `FAIL (never covered, moved ${away.compAdvancedPx}px)`);
console.log('5. 🚨 a TIMID machine does NOT   :',
  timid.cover === 0
    ? `PASS (loyalty ${timid.loyalty}, never covered, peak score ${timid.peak}) ... bravery is built, not given`
    : `FAIL (a starter machine covered ${timid.cover}x)`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
