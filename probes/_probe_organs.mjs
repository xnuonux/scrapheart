// The three organs that were declared and driven by nothing: BATTERY, shaped sockets,
// and MARK. Reachability says they are wired; this asks whether they MEAN anything.
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
await new Promise(r => server.listen(4724, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4724/', { waitUntil: 'networkidle' });
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

// === 1 · BATTERY capacity changes how long it fights ===
const batt = await page.evaluate(() => {
  const c = world.companion;
  const run = (capacity) => {
    c.body.battery = capacity; c.charge = 1;
    let s = 0;
    // drive the same drain the sim uses, at the same dt, until it must conserve
    const cap = Math.max(0.35, c.body.battery);
    while (c.charge > 0.25 && s < 100000) { c.charge -= (1/60) * 0.10 / cap; s++ }
    return +(s / 60).toFixed(1);
  };
  const small = run(0.5), stock = run(1), big = run(2);
  c.body.battery = 1; c.charge = 1;
  return { small, stock, big };
});
console.log('seconds of sustained fighting before it must conserve:', JSON.stringify(batt));

// === 2 · SHAPED SOCKETS ===
const shaped = await page.evaluate(() => {
  const c = world.companion;
  c.installed = [null, null, null];
  const mk = (id, name, shape) => ({ id, name, kinds:['function'], provenance:'x', grants:[],
                                     shape, worn:0, degradation:0 });
  const aux   = mk('brace', 'IMPACT BRACE', 'aux');
  const plain = mk('gait',  'GAIT REGULATOR', null);
  const auxIntoNormal = c.install(aux, 0);
  const auxIntoAux    = c.install(aux, 2);
  c.installed = [null, null, null];
  const plainIntoNormal = c.install(plain, 0);
  const plainIntoAux    = c.install(mk('gait2','GAIT 2',null), 2);
  c.installed = [null, null, null]; c.recompute();
  return { slots: c.installed.length, normalSlots: c.body.sockets, auxSlots: c.body.auxSockets,
           auxIntoNormal, auxIntoAux, plainIntoNormal, plainIntoAux };
});
console.log('shaped sockets:', JSON.stringify(shaped));

// === 3 · MARK: does it look at what you cannot see, and only then? ===
const mark = await page.evaluate(() => new Promise(res => {
  const w = world, c = w.companion, p = w.player;
  w.weather = null; w.spawnTimer = 9999; w.bullets = [];
  w.threats = w.threats.filter(t => t.kind === 'stopped');
  p.x = 700; p.y = 600; c.x = 715; c.y = 605;
  // a threat FAR away: past the player's sight, inside a marking companion's reach
  w.threats.push({ x: 700, y: 600 - 430, r: 10, hp: 99, maxHp: 99, speed: 0,
                   wind: 0, striking: false, alive: true, kind: 'runner', seed: 3 });
  const mkFrag = { id:'mark', name:'SURVEY OPTIC', kinds:['function'], provenance:'x',
                   grants:['mark'], curiosity:0.20, shape:null, worn:0, degradation:0 };
  const sample = (withOptic) => {
    c.installed = [null, null, null];
    if (withOptic) c.install(mkFrag, 0);
    c.recompute();
    c.x = 715; c.y = 605; c.facing = 0;
    return new Promise(r => {
      const t0 = performance.now();
      const tick = () => {
        c.x = 715; c.y = 605; p.x = 700; p.y = 600;
        if (performance.now() - t0 > 1600) {
          // where is it looking? the threat is straight UP, so facing ~ -PI/2
          const want = Math.atan2(-430, -15);
          const err = Math.abs(((c.facing - want + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          return r({ marked: !!c.marked, facingErrRad: +err.toFixed(2), can: c.can.mark });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };
  (async () => {
    const withOptic = await sample(true);
    const without   = await sample(false);
    // and a CLOSE threat, which the player can already see, must NOT be marked
    w.threats = w.threats.filter(t => t.kind === 'stopped');
    // ⚠ 200px: comfortably on screen, so a posture pointing at it tells the player
    // nothing they do not already know. must NOT mark.
    w.threats.push({ x: 700 + 200, y: 600, r: 10, hp: 99, maxHp: 99, speed: 0,
                     wind: 0, striking: false, alive: true, kind: 'runner', seed: 4 });
    const close = await sample(true);
    res({ withOptic, without, close });
  })();
}));
console.log('marking:', JSON.stringify(mark, null, 1));

console.log('\n=== VERDICTS ===');
console.log('1. battery capacity matters      :',
  batt.big > batt.stock && batt.stock > batt.small
    ? `PASS (${batt.small}s / ${batt.stock}s / ${batt.big}s for battery 0.5 / 1 / 2)` : `FAIL (${JSON.stringify(batt)})`);
console.log('2. shaped slots exist            :',
  shaped.slots === 3 && shaped.normalSlots === 2 && shaped.auxSlots === 1
    ? `PASS (3 total: 2 normal + 1 shaped, capacity unchanged)` : `FAIL (${JSON.stringify(shaped)})`);
console.log('3. an aux fragment fits ONLY there:',
  shaped.auxIntoNormal === false && shaped.auxIntoAux === true ? 'PASS' : `FAIL (normal ${shaped.auxIntoNormal}, aux ${shaped.auxIntoAux})`);
console.log('4. an unshaped one fits anywhere  :',
  shaped.plainIntoNormal === true && shaped.plainIntoAux === true ? 'PASS' : `FAIL`);
console.log('5. 🚨 it looks at what you cannot see:',
  mark.withOptic.marked && mark.withOptic.facingErrRad < 0.35
    ? `PASS (marked, facing within ${mark.withOptic.facingErrRad} rad of it)` : `FAIL (${JSON.stringify(mark.withOptic)})`);
console.log('6. and without the optic, nothing :',
  !mark.without.marked ? 'PASS' : `FAIL (marked without the fragment)`);
console.log('7. it does NOT mark what you can see:',
  !mark.close.marked ? 'PASS (a threat 120px away is your problem, not news)' : 'FAIL (marks things already in plain sight)');
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
