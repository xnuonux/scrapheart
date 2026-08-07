// IND-34c permadeath. The claim: everything you HAD is gone, and the thing you BUILT
// is not, and it does not simply resume.
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

await new Promise(r => server.listen(4705, r));
const out = SHOTS;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,160)) });
const shot = async (p) => { try { await page.screenshot({ path: p }) } catch { } };
await page.goto('http://127.0.0.1:4705/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

const walkTo = async (getT, ms=25000) => {
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
const st = () => page.evaluate(() => ({
  run: world.run, records: world.records,
  pack: world.pack.length, banked: world.banked.length,
  comp: world.companion && { name: world.companion.name,
    frags: world.companion.liveFragments.map(f=>f.name),
    bond: +world.companion.bond.toFixed(2),
    loyalty: +world.companion.loyalty.toFixed(2), caution: +world.companion.caution.toFixed(2) },
  waiting: world.waiting && { x: Math.round(world.waiting.x), y: Math.round(world.waiting.y),
    frags: world.waiting.c.liveFragments.map(f=>f.name), name: world.waiting.c.name },
  px: Math.round(world.player.x), py: Math.round(world.player.y),
  logs: world.logs.map(l=>l.text),
}));

// build something worth losing: companion + fragments installed + banked loot
await walkTo(() => world.chassis?.taken ? null
  : { dx: world.chassis.x - world.player.x, dy: world.chassis.y - world.player.y });
for (let i = 0; i < 4; i++) {
  await walkTo(() => {
    const s = world.salvage.filter(s=>s.frag).sort((a,b)=>
      Math.hypot(a.x-world.player.x,a.y-world.player.y)-Math.hypot(b.x-world.player.x,b.y-world.player.y))[0];
    return s ? { dx: s.x-world.player.x, dy: s.y-world.player.y } : null }, 9000);
}
// install what we can, bank the rest
await page.evaluate(() => {
  world.companion.name = 'BUCKET'; world.companion.named = true;
  (function(){
      var fit=function(f){for(var i=0;i<world.companion.installed.length;i++){if(world.companion.installed[i])continue;if(f.shape==='aux'&&i<world.companion.body.sockets)continue;return i}return -1};
      var keep=[];while(world.pack.length){var f=world.pack.shift();var s=fit(f);if(s<0){keep.push(f);continue}world.companion.install(f,s)}
      world.pack.push.apply(world.pack,keep);
    })()
});
await page.keyboard.press('KeyQ'); await page.waitForTimeout(500);

let before = await st();
console.log('--- before death ---');
console.log(JSON.stringify({ run: before.run, pack: before.pack, banked: before.banked, comp: before.comp }, null, 1));
await shot(`${out}/d1-before.png`);

// die
const deathPos = await page.evaluate(() => {
  world.player.x = 1300; world.player.y = 400;
  world.companion.x = 1290; world.companion.y = 410;
  return { x: 1300, y: 400 };
});
await page.waitForTimeout(300);
await page.evaluate(() => { world.player.hp = -1 });
await page.waitForTimeout(700);
let after = await st();
console.log('\n--- after death ---');
console.log(JSON.stringify(after, null, 1));
await shot(`${out}/d2-death.png`);

console.log('\n=== VERDICTS ===');
console.log('1. gear gone (pack AND banked):',
  after.pack === 0 && after.banked === 0 && before.banked > 0
    ? `PASS (${before.banked} banked destroyed)` : `FAIL (pack ${after.pack}, banked ${after.banked}, had ${before.banked})`);
console.log('2. run counter advances    :', after.run === before.run + 1 ? `PASS (${before.run} -> ${after.run})` : 'FAIL');
console.log('3. fame recorded           :', after.records.length > 0 ? `PASS (${JSON.stringify(after.records[0])})` : 'FAIL');
console.log('4. companion NOT destroyed :', after.waiting ? `PASS (waiting, ${after.waiting.frags.length} fragments intact)` : 'FAIL');
console.log('5. it stays WHERE YOU FELL :',
  after.waiting && Math.abs(after.waiting.x - deathPos.x) < 30 && Math.abs(after.waiting.y - deathPos.y) < 30
    ? `PASS (${after.waiting.x},${after.waiting.y} vs ${deathPos.x},${deathPos.y})` : `FAIL (${JSON.stringify(after.waiting)})`);
console.log('6. new character at anchor :', after.px === 800 && after.py === 600 ? 'PASS' : `FAIL (${after.px},${after.py})`);
console.log('7. fragments survive       :',
  after.waiting && JSON.stringify(after.waiting.frags) === JSON.stringify(before.comp.frags)
    ? `PASS (${after.waiting.frags.join(', ')})` : `FAIL (${JSON.stringify(after.waiting?.frags)} vs ${JSON.stringify(before.comp.frags)})`);

// go back for it. a real expedition.
console.log('\n--- going back for it ---');
await walkTo(() => world.waiting
  ? { dx: world.waiting.x - world.player.x, dy: world.waiting.y - world.player.y } : null, 40000);
await page.waitForTimeout(500);
const back = await st();
console.log(JSON.stringify({ comp: back.comp, waiting: back.waiting, logs: back.logs.slice(0,2) }, null, 1));
console.log('8. retrieved               :', back.comp && !back.waiting ? 'PASS' : 'FAIL');
console.log('9. does NOT simply resume  :',
  back.comp && back.comp.bond < 0.5 && back.comp.loyalty < before.comp.loyalty && back.comp.caution > before.comp.caution
    ? `PASS (loyalty ${before.comp.loyalty} -> ${back.comp.loyalty}, caution ${before.comp.caution} -> ${back.comp.caution})`
    : `FAIL (bond ${back.comp?.bond}, loyalty ${back.comp?.loyalty} vs ${before.comp.loyalty}, caution ${back.comp?.caution} vs ${before.comp.caution})`);
console.log('10. everything you BUILT survived:',
  back.comp && JSON.stringify(back.comp.frags) === JSON.stringify(before.comp.frags)
    ? `PASS (${back.comp.frags.join(', ')})` : 'FAIL');
console.log('11. name survives          :', back.comp?.name === 'BUCKET' ? 'PASS' : `FAIL (${back.comp?.name})`);
await shot(`${out}/d3-retrieved.png`);

// the bond has to be earnable back, and not instantly
console.log('\n--- earning it back (30s of ordinary company) ---');
const b0 = (await st()).comp.bond;
const t0 = Date.now();
while (Date.now() - t0 < 30000) {
  await page.evaluate(() => { world.threats = []; world.spawnTimer = 999 });
  await page.waitForTimeout(900);
}
const b1 = await st();
console.log(`   bond ${b0} -> ${b1.comp.bond} | loyalty ${b1.comp.loyalty} | caution ${b1.comp.caution}`);
console.log('12. bond recovers, not instantly:',
  b1.comp.bond > b0 && b1.comp.bond < 1 ? `PASS (+${(b1.comp.bond-b0).toFixed(2)} in 30s)` :
  b1.comp.bond >= 1 ? 'FAIL (recovered fully in 30s ... too cheap)' : 'FAIL (no recovery)');

const perf = await page.evaluate(async () => { let n=0; const t0=performance.now();
  await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(null) }; requestAnimationFrame(f) });
  return Math.round(n/((performance.now()-t0)/1000)) });
console.log('\nfps:', perf, '| page errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
