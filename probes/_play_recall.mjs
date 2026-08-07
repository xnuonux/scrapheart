// Probe for IND-34c THE RECALL. Measures the four claims:
//   1. it banks the pack   2. it is instant   3. it always works   4. death costs the pack
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
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };
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

await new Promise(r => server.listen(4701, r));

const out = SHOTS;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0,220)));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,180)) });

await page.goto('http://127.0.0.1:4701/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const read = () => page.evaluate(() => ({
  hp: Math.round(world.player.hp),
  px: Math.round(world.player.x), py: Math.round(world.player.y),
  ax: world.anchor.x, ay: world.anchor.y,
  distFromAnchor: Math.round(Math.hypot(world.player.x - world.anchor.x, world.player.y - world.anchor.y)),
  // ⚠ HOSTILE threats. The stopped ones (IND-34l) and the degree-2 warden survive a
  // recall on purpose ... they are the world's furniture, and clearing them would mean
  // the field quietly empties itself every time the player goes home.
  threats: world.threats.filter(t=>t.alive && t.kind!=='stopped' && t.degree!==2).length,
  furniture: world.threats.filter(t=>t.alive && (t.kind==='stopped'||t.degree===2)).length,
  pack: world.pack.length, banked: world.banked.length,
  recalls: world.recallCount, abandoned: world.abandoned,
  comp: world.companion ? Math.round(Math.hypot(world.companion.x - world.anchor.x, world.companion.y - world.anchor.y)) : null,
  logs: world.logs.map(l=>l.text),
}));

const walkTo = async (getT, ms=14000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const st = await page.evaluate(getT);
    if (!st) break;
    const keys = [];
    if (st.dx > 12) keys.push('KeyD'); else if (st.dx < -12) keys.push('KeyA');
    if (st.dy > 12) keys.push('KeyS'); else if (st.dy < -12) keys.push('KeyW');
    if (!keys.length) break;
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(160);
    for (const k of keys) await page.keyboard.up(k);
  }
};

// ── get the companion + some loot, then go FAR from the anchor
await walkTo(() => world.chassis?.taken ? null
  : { dx: world.chassis.x - world.player.x, dy: world.chassis.y - world.player.y });
await walkTo(() => {
  const s = world.salvage.filter(s=>s.frag).sort((a,b)=>
    Math.hypot(a.x-world.player.x,a.y-world.player.y)-Math.hypot(b.x-world.player.x,b.y-world.player.y))[0];
  return (!s || world.pack.length >= 2) ? null : { dx: s.x-world.player.x, dy: s.y-world.player.y };
}, 20000);

let before = await read();
console.log('--- before recall ---');
console.log(JSON.stringify(before, null, 1));
await page.screenshot({ path: `${out}/rc-before.png` });

// ── CLAIM 2: instant. measure the state one animation frame after keydown.
const instant = await page.evaluate(() => new Promise(res => {
  const p0 = { x: world.player.x, y: world.player.y, pack: world.pack.length };
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }));
    res({ before: p0, afterX: Math.round(world.player.x), afterY: Math.round(world.player.y),
          movedPx: Math.round(Math.hypot(world.player.x - p0.x, world.player.y - p0.y)),
          packBefore: p0.pack, packAfter: world.pack.length, banked: world.banked.length });
  }));
}));
console.log('\n--- CLAIM: instant (state after 2 rAF) ---');
console.log(JSON.stringify(instant, null, 1));

await page.waitForTimeout(600);
const after = await read();
console.log('\n--- after recall ---');
console.log(JSON.stringify(after, null, 1));
await page.screenshot({ path: `${out}/rc-after.png` });

console.log('\n=== VERDICTS ===');
console.log('1. banks the pack :', before.pack > 0 && after.pack === 0 && after.banked === before.banked + before.pack
  ? `PASS (${before.pack} -> banked ${after.banked})` : `FAIL (pack ${before.pack}->${after.pack}, banked ${before.banked}->${after.banked})`);
console.log('2. instant        :', instant.movedPx > 50 && instant.packAfter === 0
  ? `PASS (moved ${instant.movedPx}px within 2 frames)` : `FAIL (moved ${instant.movedPx}px, pack ${instant.packAfter})`);
console.log('3. lands at anchor:', after.distFromAnchor < 5 ? 'PASS' : `FAIL (${after.distFromAnchor}px off)`);
console.log('4. site resets    :', after.threats === 0
  ? `PASS (0 hostiles; ${after.furniture} stopped/broken left standing, as intended)`
  : `FAIL (${after.threats} hostiles survived)`);
// ⚠ 80px, not 40. It is placed at 28px and then it MOVES, because it is a companion and
// not a trailer. The claim is "it came with you" and the failure case is 300px+.
console.log('5. companion came :', after.comp !== null && after.comp < 80 ? `PASS (${after.comp}px)` : `FAIL (${after.comp})`);

// ── CLAIM 3: always available. spam it mid-combat while overheated.
console.log('\n--- CLAIM: always available (spam under load) ---');
let overheatedAtLeastOnce = false;
for (let i = 0; i < 4; i++) {
  // hold fire long enough to actually LOCK the weapon. the point of the test is that
  // the recall works in the worst state the game can put you in.
  await page.keyboard.down('KeyD'); await page.mouse.move(900, 400);
  // measured: heat climbs ~0.27/s net, so the lock needs ~3.7s of held fire.
  await page.mouse.down(); await page.waitForTimeout(5000); await page.mouse.up();
  await page.keyboard.up('KeyD');
  const heat = await page.evaluate(() => ({ heat: +world.player.heat.toFixed(2), over: +world.player.overheated.toFixed(1) }));
  if (heat.over > 0) overheatedAtLeastOnce = true;
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(250);
  const st = await read();
  console.log(` press ${i+1}: heat ${heat.heat} overheated ${heat.over}s -> recalls=${st.recalls} dist=${st.distFromAnchor}`);
}
const spam = await read();
console.log('6. never blocked  :', spam.recalls === 5 ? 'PASS (5/5 registered)' : `FAIL (${spam.recalls} of 5)`);
console.log('6b. proven under overheat lock:', overheatedAtLeastOnce ? 'YES' : 'NO ... test did not reach the locked state, claim unproven');

// ── CLAIM 4: death costs the pack
console.log('\n--- CLAIM: death costs the pack ---');
const death = await page.evaluate(() => new Promise(res => {
  world.pack.push({ name: 'TEST PART', kinds: ['x'], provenance: 'probe', degradation: 0, worn: 0 });
  const packBefore = world.pack.length, bankedBefore = world.banked.length;
  world.player.hp = -1;   // ⚠ 0.0001 does NOT satisfy `hp <= 0`. the first probe measured nothing.
  setTimeout(() => res({ packBefore, bankedBefore, packAfter: world.pack.length,
    bankedAfter: world.banked.length, hp: Math.round(world.player.hp),
    log: world.logs[0]?.text }), 400);
}));
console.log(JSON.stringify(death, null, 1));
// ⚠ Updated for permadeath. This used to assert that BANKED survives death, which was
// true of the old stub and is now deliberately false: IND-34c says gear gone, and if
// banking were death-proof there would be no permadeath, only an inconvenient
// checkpoint. The recall protects you from a room, never from dying.
console.log('7. death takes pack AND bank:', death.packAfter === 0 && death.bankedAfter === 0
  ? `PASS (${death.packBefore} carried + ${death.bankedBefore} banked, all gone)`
  : `FAIL (pack ${death.packAfter}, banked ${death.bankedAfter})`);

const perf = await page.evaluate(async () => {
  let n=0; const t0=performance.now();
  await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(null) }; requestAnimationFrame(f) });
  return Math.round(n / ((performance.now()-t0)/1000));
});
console.log('\nfps:', perf);
console.log('page errors:', errs.length ? errs.join(' | ') : 'none');
await page.screenshot({ path: `${out}/rc-final.png` });
await browser.close(); server.close();
