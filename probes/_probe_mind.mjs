// Probe the companion's mind directly. Two claims under test:
//   A. investigate can never outscore follow at starter curiosity
//   B. the RAM warm set has no effect on the pick (it is decorative)
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
await new Promise(r => server.listen(4702, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4702/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// grab the companion
const walkTo = async (getT, ms=14000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const st = await page.evaluate(getT); if (!st) break;
    const keys = [];
    if (st.dx > 12) keys.push('KeyD'); else if (st.dx < -12) keys.push('KeyA');
    if (st.dy > 12) keys.push('KeyS'); else if (st.dy < -12) keys.push('KeyW');
    if (!keys.length) break;
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(150);
    for (const k of keys) await page.keyboard.up(k);
  }
};
await walkTo(() => world.chassis?.taken ? null
  : { dx: world.chassis.x - world.player.x, dy: world.chassis.y - world.player.y });

// stand the player right next to an unseen interest point, threats cleared, and watch.
const setup = await page.evaluate(() => {
  world.threats = []; world.spawnTimer = 999;
  const i = world.interest.find(i => !i.seen);
  world.player.x = i.x - 40; world.player.y = i.y - 40;
  world.companion.x = i.x - 55; world.companion.y = i.y - 55;
  return { curiosity: +world.companion.curiosity.toFixed(3), ram: world.companion.body.ram,
           gpu: world.companion.body.gpu,
           frags: world.companion.liveFragments.map(f=>f.name) };
});
console.log('setup:', JSON.stringify(setup));

// sample the scorer for 4s with everything calm and something interesting touching it
const samples = await page.evaluate(() => new Promise(res => {
  const out = []; const t0 = performance.now();
  const tick = () => {
    world.threats = [];
    const c = world.companion;
    out.push({ s: { ...c.scores }, warm: [...c.warm], beh: c.behaviour });
    if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else res(out);
  };
  requestAnimationFrame(tick);
}));

const withScores = samples.filter(s => Object.keys(s.s).length);
const avg = k => +(withScores.reduce((a,s)=>a+(s.s[k]??0),0)/withScores.length).toFixed(3);
const max = k => +Math.max(...withScores.map(s=>s.s[k]??0)).toFixed(3);
console.log('\nsamples with scores:', withScores.length);
console.log('behaviour           avg     max');
for (const k of ['follow','investigate','salvage','engage','cover','repair','flee'])
  console.log(` ${k.padEnd(14)} ${String(avg(k)).padStart(7)} ${String(max(k)).padStart(7)}`);

const investigated = withScores.filter(s => s.beh === 'investigate').length;
console.log('\nA. investigate ever chosen, calm + touching an interest point:',
  investigated ? `YES (${investigated}/${withScores.length} frames)` : 'NO ... unreachable');
console.log('   max investigate', max('investigate'), 'vs min follow',
  +Math.min(...withScores.map(s=>s.s.follow??9)).toFixed(3));

// B: is the chosen behaviour ever NOT the top-scoring one?
let disagreements = 0, checked = 0;
for (const s of withScores) {
  const ranked = Object.entries(s.s).sort((a,b)=>b[1]-a[1]);
  if (!ranked.length) continue;
  checked++;
  if (ranked[0][0] !== s.beh) disagreements++;
}
console.log(`\nB. RAM gating: pick differed from top-scorer in ${disagreements}/${checked} samples`);
console.log('   verdict:', disagreements === 0
  ? 'DECORATIVE ... the warm set never changes the outcome, so RAM gates nothing'
  : 'REAL ... RAM demonstrably drops behaviours');
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
