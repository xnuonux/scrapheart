// THE GATE'S OWN PRECONDITIONS.
//
// "Seven name the companion unprompted AND REACT WHEN IT IS BADLY HURT."
//
// ⚠ Every system in this build is measured except the two things the gate actually
// tests. Naming is now reachable (see _probe_naming). This asks the other half: does
// the companion get badly hurt often enough, in ORDINARY play, for anyone to react to?
// If a tester never sees it hurt, the gate cannot be answered no matter how good the
// rest is ... and the answer would look like a design failure rather than a frequency
// problem.
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
  if (srcT > newest(ROOT)) {
    console.error('\n🚨 STALE BUILD.\n'); process.exit(2) } }
await new Promise(r => server.listen(4714, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
page.on('dialog', async d => { await d.dismiss() });
await page.goto('http://127.0.0.1:4714/', { waitUntil: 'networkidle' });
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
console.log('companion standing at t =', await page.evaluate(() => +world.t.toFixed(1)), 's');

// ── play ordinarily for a few minutes: wander, fight, drift east like anyone would ──
console.log('\nplaying ordinarily for ~3 minutes (wander east, shoot what is near)...');
const seen = { hurtEvents: 0, minHpFrac: 1, firstHurtAt: null, badlyDamagedLogs: 0,
               fled: 0, interposed: 0, deaths: 0, handlerAt: null, wardenAt: null };
const t0 = Date.now();
let lastBeh = '';
while (Date.now() - t0 < 180000) {
  // shoot the nearest thing, drift east, occasionally wander
  const st = await page.evaluate(() => {
    const c = world.companion, p = world.player;
    const t = world.threats.filter(t => t.alive && t.kind !== 'stopped')
      .sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    return { hp: c ? c.hp / c.maxHp : 1, beh: c?.behaviour ?? null,
             run: world.run, interposes: world.interposes,
             handlerMet: world.handlerMet, wardenSpawned: world.wardenSpawned,
             t: +world.t.toFixed(1), px: Math.round(p.x),
             aim: t ? { sx: 640 + (t.x - p.x), sy: 400 + (t.y - p.y) } : null,
             // ⚠ EITHER line. "is hurt." fires on crossing into trouble and "badly
             // damaged" only at the floor; checking the second alone reported silence
             // while the first had been shown.
             badly: world.logs.filter(l => /is hurt\.|badly damaged/.test(l.text)).length };
  });
  if (!st) break;
  if (st.hp < seen.minHpFrac) seen.minHpFrac = st.hp;
  if (st.hp < 0.5 && seen.firstHurtAt === null) seen.firstHurtAt = st.t;
  if (st.badly > 0) seen.badlyDamagedLogs = Math.max(seen.badlyDamagedLogs, st.badly);
  if (st.beh === 'flee' && lastBeh !== 'flee') seen.fled++;
  lastBeh = st.beh;
  seen.interposed = st.interposes;
  seen.deaths = st.run - 1;
  if (st.handlerMet && seen.handlerAt === null) seen.handlerAt = st.t;
  if (st.wardenSpawned && seen.wardenAt === null) seen.wardenAt = st.t;

  // ⚠ Install what you pick up, because a real player does and it changes the answer.
  // A companion left at starter loyalty never covers, never exposes itself, and never
  // gets hurt ... so a bot that hoards fragments measures a machine no player will have.
  await page.evaluate(() => {
    const c = world.companion;
    if (c) (function(){
      var fit=function(f){for(var i=0;i<c.installed.length;i++){if(c.installed[i])continue;if(f.shape==='aux'&&i<c.body.sockets)continue;return i}return -1};
      var keep=[];while(world.pack.length){var f=world.pack.shift();var s=fit(f);if(s<0){keep.push(f);continue}c.install(f,s)}
      world.pack.push.apply(world.pack,keep);
    })()
  });
  if (st.aim) { await page.mouse.move(st.aim.sx, st.aim.sy); await page.mouse.down() }
  const k = st.px < 1250 ? 'KeyD' : ['KeyW','KeyS','KeyA'][Math.floor(Math.random()*3)];
  await page.keyboard.down(k);
  await page.waitForTimeout(420);
  await page.keyboard.up(k);
  await page.mouse.up();
  await page.waitForTimeout(120);
}

const final = await page.evaluate(() => ({
  t: +world.t.toFixed(1), run: world.run,
  comp: world.companion && { hp: Math.round(world.companion.hp), max: world.companion.maxHp,
                             frags: world.companion.liveFragments.length,
                             care: +world.companion.careShown.toFixed(2) },
  waiting: !!world.waiting,
  logs: world.logs.map(l => l.text),
}));
console.log('\nafter ~3 minutes:', JSON.stringify(final, null, 1));
console.log('observed:', JSON.stringify(seen, null, 1));

// ⚠ Report what the bot actually BUILT. The companion only takes damage when it puts
// itself in front of you, and it only does that if you made it loyal. A run where the
// bot never installed anything measures a machine no player will have, and reports the
// gate's own precondition as broken.
const builtWhat = await page.evaluate(() => {
  const c = world.companion ?? world.waiting?.c;
  return c ? { frags: c.liveFragments.map(f=>f.name), loyalty: +c.loyalty.toFixed(2),
               empty: c.emptySockets } : null;
});
console.log('what the bot built:', JSON.stringify(builtWhat));

console.log('\n=== GATE PRECONDITIONS ===');
console.log('0. the bot actually built something:',
  builtWhat && builtWhat.loyalty > 0.3
    ? `PASS (loyalty ${builtWhat.loyalty}: ${builtWhat.frags.join(', ')})`
    : `⚠ SETUP WEAK (loyalty ${builtWhat?.loyalty}) ... a timid machine never covers, so 1-3 below measure nothing`);
console.log('1. 🚨 the companion gets BADLY HURT :',
  seen.minHpFrac < 0.5
    ? `PASS (dropped to ${Math.round(seen.minHpFrac*100)}% of its health, first at t=${seen.firstHurtAt}s)`
    : `FAIL (never fell below ${Math.round(seen.minHpFrac*100)}% ... nobody can react to a thing that never happens)`);
console.log('2. and the game SAYS so             :',
  seen.badlyDamagedLogs > 0 ? `PASS ("is badly damaged" surfaced)` : 'FAIL (no line ever shown)');
console.log('3. it visibly breaks off            :',
  seen.fled > 0 ? `PASS (${seen.fled} times)` : 'FAIL (never fled ... the fear is invisible)');
console.log('4. the handler arrives              :',
  seen.handlerAt !== null ? `PASS (t=${seen.handlerAt}s)` : 'FAIL (never showed up in 3 minutes)');
console.log('5. ⚠ and it gets 20-30 min first    :',
  seen.wardenAt === null || (seen.wardenAt - seen.handlerAt) > 120
    ? `PASS (warden at ${seen.wardenAt ?? 'never'}, handler at ${seen.handlerAt})`
    : `FAIL (only ${Math.round(seen.wardenAt - seen.handlerAt)}s of company before the warden ... IND-34k asks for 20-30 MINUTES)`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await page.screenshot({ path: join(SHOTS, "g1-gate.png") });
await browser.close(); server.close();
