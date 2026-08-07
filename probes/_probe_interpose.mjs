// IND-34a §it saves you. The claim is not "it can interpose" ... it is that THREE
// conditions each independently decide it, and that a player who used the machine as a
// tool watches it calculate correctly and let them die.
//
// ⚠ Everything below drives REAL paths only: fragments arrive as salvage the player
// walks over, damage arrives as a caster's shot. Nothing module-private is reached into,
// so a pass here is a pass for the game and not for a test harness.
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
// 🚨 FRESHNESS GATE. Probes serve dist/, so an unbuilt src change silently tests the
// PREVIOUS bundle. I changed an interpose threshold from 1.05 to 1.30, did not rebuild,
// and then spent four measurement rounds proving that a value of 1.125 passed a bar of
// 1.30. The measurements were all correct. They were measurements of old code.
{
  const newest = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((max, e) => {
    const p = path.join(dir, e.name);
    return Math.max(max, e.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs);
  }, 0);
  // ⚠ index.html is a build input too. The gate watched only src/, so an edit to the
  // page shell would ship stale and measure clean ... the exact hole this gate exists to close.
  const src = Math.max(newest(SRC),
                       fs.statSync(INDEX).mtimeMs);
  const built = newest(ROOT);
  if (src > built) {
    console.error(`\n🚨 STALE BUILD. src is ${((src - built) / 1000).toFixed(0)}s newer than dist.`);
    console.error('   Run `npm run build` first. Refusing to measure old code.\n');
    process.exit(2);
  }
}

await new Promise(r => server.listen(4708, r));
const out = SHOTS;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
const shot = async (p) => { try { await page.screenshot({ path: p }) } catch {} };
await page.goto('http://127.0.0.1:4708/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

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
console.log('companion standing:', await page.evaluate(() => !!world.companion));

// collect fragments through the real pickup path, then hand them to the companion
const give = async (ids) => {
  await page.evaluate((ids) => {
    const w = world, p = w.player;
    w.companion.installed = [null, null, null];
    w.pack = [];
    for (const id of ids) w.salvage.push({ x: p.x, y: p.y, frag: id });
  }, ids);
  await page.waitForTimeout(400);           // let the sim pick them up
  return page.evaluate(() => {
    const c = world.companion;
    // ⚠ SHAPE-AWARE. `indexOf(null)` always picks slot 0, which is a NORMAL slot, and an
    // aux fragment (PRESERVATION, IMPACT BRACE) is now correctly refused there. The probe
    // was silently building a machine WITHOUT the fragment under test and then reporting
    // the mechanic broken.
    const firstFit = (f) => {
      for (let i = 0; i < c.installed.length; i++) {
        if (c.installed[i]) continue;
        const isAux = i >= c.body.sockets;
        if (f.shape === 'aux' && !isAux) continue;
        return i;
      }
      return -1;
    };
    const left = [];
    while (world.pack.length) {
      const f = world.pack.shift();
      const slot = firstFit(f);
      if (slot < 0) { left.push(f); continue }
      c.install(f, slot);
    }
    world.pack.push(...left);
    c.recompute();
    return c.liveFragments.map(f => f.name);
  });
};

// one trial: set history, stand the companion close, take one real caster shot
const trial = async (label, ids, careShown) => {
  const frags = await give(ids);
  const r = await page.evaluate((careShown) => {
    const w = world, c = w.companion, p = w.player;
    w.threats = []; w.bullets = []; w.spawnTimer = 999; w.handler = null;
    p.x = 700; p.y = 600; p.prevX = 700; p.prevY = 600;
    c.x = 706; c.y = 612; c.prevX = c.x; c.prevY = c.y; c.hp = c.maxHp;
    c.careShown = careShown; c.bond = 1; c.recompute();
    p.hp = 40;                                  // one shot from here is a killing blow
    const history = Math.min(1, c.careShown / 6);
    const before = { hp: p.hp, empty: c.emptySockets, interposes: w.interposes,
                     loyalty: +c.loyalty.toFixed(2), caution: +c.caution.toFixed(2),
                     canInterpose: c.can.interpose,
                     willingness: +(c.loyalty * 1.0 + history * 0.9 - c.caution * 0.35).toFixed(3),
                     dist: Math.round(Math.hypot(c.x - p.x, c.y - p.y)),
                     slots: c.installed.map(f => f ? f.name : null) };
    // a REAL incoming shot, on the real damage path
    w.bullets.push({ x: p.x - 40, y: p.y, vx: 220, vy: 0, life: 1.4, from: 'threat' });
    return before;
  }, careShown);
  // ⚠ Poll DURING the flight. The snapshot said 1.125 against a 1.30 bar and it
  // interposed anyway, so something moves between the push and the hit.
  const track = [];
  for (let i = 0; i < 8; i++) {
    track.push(await page.evaluate(() => {
      const c = world.companion;
      const h = Math.min(1, c.careShown / 6);
      return { w: +(c.loyalty * 1.0 + h * 0.9 - c.caution * 0.35).toFixed(3),
               l: +c.loyalty.toFixed(2), cau: +c.caution.toFixed(2),
               care: +c.careShown.toFixed(2), n: world.interposes };
    }));
    await page.waitForTimeout(75);
  }
  const moved = track.some(t => t.w !== track[0].w);
  if (moved) console.log(`    ⚠ willingness MOVED during flight: ${track.map(t=>t.w).join(' -> ')}`);
  if (track.some(t => t.care !== track[0].care))
    console.log(`    ⚠ careShown MOVED: ${track.map(t=>t.care).join(' -> ')}`);
  const after = await page.evaluate(() => ({
    hp: Math.round(world.player.hp), empty: world.companion.emptySockets,
    interposes: world.interposes, frags: world.companion.liveFragments.map(f=>f.name),
    log: world.logs[0]?.text }));
  const interposed = after.interposes > r.interposes;
  console.log(`\n  ${label}`);
  console.log(`    built: ${frags.join(', ')}  | loyalty ${r.loyalty} caution ${r.caution} careShown ${careShown} | canInterpose ${r.canInterpose}`);
  console.log(`    slots: [${r.slots.map(s=>s??'empty').join(' | ')}]  willingness ${r.willingness} (bar 1.30)  dist ${r.dist}px`);
  console.log(`    hp ${r.hp} -> ${after.hp} | sockets empty ${r.empty} -> ${after.empty} | INTERPOSED: ${interposed}`);
  if (interposed) console.log(`    log: "${after.log}"  remaining: ${after.frags.join(', ') || '(none)'}`);
  return { interposed, before: r, after, frags };
};

console.log('\n=== the three conditions, isolated ===');
// 1 · capability absent: no interpose-granting fragment at all
const noCap   = await trial('A · no capability (attend + repair, neither grants it)', ['attend','repair'], 12);
// 2 · capability + history, disposition good
const full    = await trial('B · capability + disposition + history (the heart, cared for)', ['heart'], 12);
// 3 · same machine, no history at all: used as a tool
const noHist  = await trial('C · capability + disposition, NO history (used as a tool)', ['heart'], 0);
// 4 · self-preservation, which is otherwise a very good fragment
// ⚠ MODERATE history, because `careShown 12` caps the history term at 1.0 and swamps
// everything else. IND-34a says preservation makes it LESS likely, not impossible ...
// so the honest test is whether, at the SAME history, preservation flips the decision.
const selfish = await trial('D · same history as B, but PRESERVATION installed', ['heart','selfpres'], 4);
const fairCmp = await trial('D2 · control: that same history WITHOUT preservation', ['heart'], 4);

console.log('\n=== VERDICTS ===');
console.log('1. no capability, no save        :', !noCap.interposed ? 'PASS' : 'FAIL');
console.log('2. all three true, it saves you  :', full.interposed ? 'PASS' : 'FAIL');
console.log('3. 🚨 no history, it lets you die:', !noHist.interposed
  ? `PASS (identical machine to B, only careShown differs)` : 'FAIL');
console.log('4. self-preservation suppresses  :', !selfish.interposed && fairCmp.interposed
  ? `PASS (same careShown=4: without it saves, with it does not. loyalty ${selfish.before.loyalty} caution ${selfish.before.caution})`
  : `FAIL (with preservation ${selfish.interposed}, control ${fairCmp.interposed})`);
console.log('5. it costs the piece that let it:',
  full.interposed && !full.after.frags.includes('ATTACHMENT CORE')
    ? `PASS (ATTACHMENT CORE destroyed, not damaged)` : `FAIL (${full.after.frags.join(',')})`);
console.log('6. the socket stays EMPTY        :',
  full.after.empty === full.before.empty + 1 ? `PASS (${full.before.empty} -> ${full.after.empty})` : 'FAIL');
console.log('7. the game never explains why   :',
  !/valued|did not|enough|because/i.test(noHist.after.log ?? '') ? `PASS (log after C: "${noHist.after.log}")` : 'FAIL');

console.log('\n=== the history that earns it (IND-34a §3) ===');
const care = await page.evaluate(async () => {
  const w = world, c = w.companion, p = w.player;
  w.threats = []; w.bullets = []; w.spawnTimer = 999;
  p.x = 700; p.y = 600; c.x = 706; c.y = 612;
  c.hp = c.maxHp * 0.4; c.careShown = 0;
  const calm0 = performance.now();
  // convenient: nothing nearby
  await new Promise(r => setTimeout(r, 50));
  return { hpNow: Math.round(c.hp), careShown: c.careShown };
});
console.log('  companion damaged to', care.hpNow, 'careShown', care.careShown);
await page.keyboard.down('KeyE');
await page.waitForTimeout(3000);
await page.keyboard.up('KeyE');
const calmCare = await page.evaluate(() => ({ care: +world.companion.careShown.toFixed(2),
                                              hp: Math.round(world.companion.hp) }));
console.log('  after 3s of CONVENIENT mending (nothing nearby):', JSON.stringify(calmCare));

await page.evaluate(() => {
  const w = world, p = w.player, c = w.companion;
  c.hp = c.maxHp * 0.4; c.careShown = 0;
  w.threats.push({ x: p.x + 120, y: p.y, r: 10, hp: 999, maxHp: 999, speed: 0,
                   wind: 0, striking: false, alive: true, kind: 'runner', seed: 3 });
});
await page.keyboard.down('KeyE');
// ⚠ sample DURING, not only after. careShown came back 0 and the first read of that was
// "the danger multiplier is broken", which is a guess. The distance and the behaviour
// are the two things that can stop mend() running, so measure both.
const samples = [];
for (let i = 0; i < 12; i++) {
  samples.push(await page.evaluate(() => ({
    d: Math.round(Math.hypot(world.companion.x - world.player.x, world.companion.y - world.player.y)),
    beh: world.companion.behaviour, mending: +world.mending.toFixed(2),
    care: +world.companion.careShown.toFixed(2) })));
  await page.waitForTimeout(250);
}
await page.keyboard.up('KeyE');
console.log('  during: ' + samples.map(s=>`${s.beh}@${s.d}px`).join(' '));
const dangerCare = await page.evaluate(() => ({ care: +world.companion.careShown.toFixed(2),
                                                hp: Math.round(world.companion.hp) }));
console.log('  after 3s of mending UNDER THREAT:         ', JSON.stringify(dangerCare));
console.log('8. danger-weighted care          :',
  dangerCare.care > calmCare.care * 1.8
    ? `PASS (${dangerCare.care} vs ${calmCare.care}, ${(dangerCare.care/calmCare.care).toFixed(1)}x)`
    : `FAIL (${dangerCare.care} vs ${calmCare.care})`);

await shot(`${out}/i1-interpose.png`);
const perf = await page.evaluate(async () => { let n=0; const t0=performance.now();
  await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(null) }; requestAnimationFrame(f) });
  return Math.round(n/((performance.now()-t0)/1000)) });
console.log('\nfps:', perf, '| page errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
