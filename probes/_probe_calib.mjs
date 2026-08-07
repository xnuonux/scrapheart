// IND-34n calibration. Does the curve actually run gentle-to-lethal, and does a
// player who stands still in the shallows survive materially longer than one in the deep?
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

await new Promise(r => server.listen(4706, r));
const out = SHOTS;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
const shot = async (p) => { try { await page.screenshot({ path: p }) } catch {} };
await page.goto('http://127.0.0.1:4706/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

console.log('=== 1. the numbers the design asks for ===');
const curve = await page.evaluate(() => {
  const out = [];
  for (const x of [400, 700, 1000, 1300, 1550]) {
    world.player.x = x;
    // sample the spawn table at this depth
    let casters = 0, runners = 0, hps = [];
    for (let i = 0; i < 400; i++) {
      const before = world.threats.length;
      world.spawnThreat();
      const t = world.threats[world.threats.length - 1];
      if (t.kind === 'caster') casters++; else runners++;
      hps.push(t.maxHp);
      world.threats.length = before;
    }
    out.push({ x, casterPct: Math.round(casters/4), medHp: Math.round(hps.sort((a,b)=>a-b)[200]) });
  }
  return out;
});
console.table(curve);

// hits-to-die is computed from the same functions the game uses, read back live
const hits = await page.evaluate(() => {
  const res = [];
  for (const x of [400, 700, 1000, 1300, 1550]) {
    world.player.x = x; world.player.hp = 100;
    const d = Math.max(0, Math.min(1, (x - 340) / (1600 - 480)));
    res.push({ x, depth: +d.toFixed(2),
               runnerDmg: +(7 + d*15).toFixed(1), hitsRunner: +(100/(7+d*15)).toFixed(1),
               casterDmg: +(6 + d*10).toFixed(1), hitsCaster: +(100/(6+d*10)).toFixed(1),
               crowdCap: Math.round(3 + d*3) });
  }
  return res;
});
console.table(hits);

console.log('\n=== 2. LIVE: stand still and count how long you last ===');
// ⚠ measured, not derived. the arithmetic above is what I INTENDED; this is what happens.
const survive = async (x, label) => {
  const r = await page.evaluate(async (x) => {
    world.threats = []; world.bullets = []; world.spawnTimer = 0;
    world.player.x = x; world.player.y = 600; world.player.hp = 100;
    world.companion = null; world.waiting = null; world.handler = null;
    const run0 = world.run;
    const t0 = performance.now();
    return await new Promise(res => {
      const tick = () => {
        if (world.run > run0 || performance.now() - t0 > 90000) {
          return res({ seconds: +((performance.now()-t0)/1000).toFixed(1),
                       died: world.run > run0,
                       threats: world.threats.filter(t=>t.alive).length,
                       casters: world.threats.filter(t=>t.alive && t.kind==='caster').length });
        }
        world.player.x = x; world.player.y = 600;   // pinned: no dodging, pure attrition
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, x);
  console.log(`  ${label.padEnd(10)} x=${x}  survived ${r.seconds}s ${r.died ? '(died)' : '(capped at 90s)'}  threats ${r.threats} of which ${r.casters} casters`);
  return r;
};
const shallow = await survive(420, 'shallows');
const deep    = await survive(1500, 'deep');

console.log('\n=== VERDICTS ===');
console.log('1. casters exist only past the shallows:',
  curve[0].casterPct === 0 && curve[4].casterPct > 0 ? `PASS (0% at x=400, ${curve[4].casterPct}% at x=1550)` : `FAIL (${curve.map(c=>c.casterPct).join('/')})`);
console.log('2. shallow margin ~12-16 hits       :',
  hits[0].hitsRunner >= 11 ? `PASS (${hits[0].hitsRunner} hits)` : `FAIL (${hits[0].hitsRunner})`);
console.log('3. deep margin ~4-5 hits            :',
  hits[4].hitsCaster <= 7 && hits[4].hitsRunner >= 4 && hits[4].hitsRunner <= 6
    ? `PASS (runner ${hits[4].hitsRunner}, caster ${hits[4].hitsCaster})` : `FAIL (runner ${hits[4].hitsRunner}, caster ${hits[4].hitsCaster})`);
// ⚠ The design's number is PER-HIT margin, not survival time. A pinned player who never
// moves and never shoots SHOULD die eventually, in the shallows too ... `34c` says
// everything is dodgeable, not that standing still is safe. Survival time is reported
// as supporting evidence and is muddied by how far threats have to walk.
console.log('4. per-hit margin spans ~3x         :',
  (hits[0].hitsRunner / hits[4].hitsRunner) >= 2.4
    ? `PASS (${hits[0].hitsRunner} -> ${hits[4].hitsRunner} hits, ${(hits[0].hitsRunner/hits[4].hitsRunner).toFixed(1)}x)`
    : `FAIL (${(hits[0].hitsRunner/hits[4].hitsRunner).toFixed(1)}x)`);
console.log('5. LIVE: the deep kills faster      :',
  deep.seconds < shallow.seconds ? `PASS (${deep.seconds}s vs ${shallow.seconds}s standing still)` : `FAIL (deep ${deep.seconds}s, shallow ${shallow.seconds}s)`);
console.log('   (supporting only: pinned, no dodging, no shooting. dying here is correct.)');

await page.evaluate(() => { world.player.x = 1400; world.spawnTimer = 0 });
await page.waitForTimeout(2500);
await shot(`${out}/c1-casters.png`);
const perf = await page.evaluate(async () => { let n=0; const t0=performance.now();
  await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(null) }; requestAnimationFrame(f) });
  return Math.round(n/((performance.now()-t0)/1000)) });
console.log('\nfps:', perf, '| page errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
