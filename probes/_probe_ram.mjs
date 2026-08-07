// Discriminating test for RAM gating.
// Settle the warm set on {follow, investigate} in a calm field, then make a THIRD
// behaviour the runaway top scorer and measure the lag before it can be acted on.
// If RAM gates, low RAM lags and high RAM does not. If it is decorative, both are 0.
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
await new Promise(r => server.listen(4703, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
await page.goto('http://127.0.0.1:4703/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

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

// run the trial at a given RAM. returns ms from "flee became top" to "flee was acted on".
const trial = (ram) => page.evaluate((ram) => new Promise(res => {
  const c = world.companion;
  c.body.ram = ram;
  c.warm.clear(); c.swapCd = 0;
  world.threats = []; world.spawnTimer = 999;
  c.hp = c.maxHp;
  // settle: calm, an interest point right there, so warm converges away from flee
  const i = world.interest.find(i => !i.seen) ?? world.interest[0];
  i.seen = false;
  world.player.x = i.x - 40; world.player.y = i.y - 40;
  c.x = i.x - 30; c.y = i.y - 30;

  setTimeout(() => {
    const settledWarm = [...c.warm];
    // SHOCK: badly hurt + a threat on top of it. flee should be the runaway top score.
    c.hp = c.maxHp * 0.05;
    world.threats.push({ x: c.x + 12, y: c.y + 12, r: 10, hp: 999, maxHp: 999,
      speed: 0, wind: 0, striking: false, alive: true, kind: 'runner', seed: 1 });
    const t0 = performance.now();
    let topWasFleeAt = null, actedAt = null, frames = 0;
    const tick = () => {
      frames++;
      c.hp = c.maxHp * 0.05;                 // hold the shock
      const ranked = Object.entries(c.scores).sort((a,b)=>b[1]-a[1]);
      if (topWasFleeAt === null && ranked[0]?.[0] === 'flee') topWasFleeAt = performance.now();
      if (actedAt === null && c.behaviour === 'flee') actedAt = performance.now();
      if ((actedAt !== null) || performance.now() - t0 > 4000) {
        return res({ ram, settledWarm, warmAfter: [...c.warm], frames,
          topWasFlee: topWasFleeAt !== null,
          lagMs: (topWasFleeAt !== null && actedAt !== null)
            ? Math.round(actedAt - topWasFleeAt) : null,
          acted: actedAt !== null, behaviour: c.behaviour });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, 2500);
}), ram);

console.log('shock test: settle calm, then make flee the runaway top scorer.\n');
for (const ram of [2, 3, 7]) {
  const r = await trial(ram);
  console.log(`RAM ${ram}: settled warm ${JSON.stringify(r.settledWarm)}`);
  console.log(`        flee became top: ${r.topWasFlee} | acted: ${r.acted} | lag: ${r.lagMs}ms | warm after ${JSON.stringify(r.warmAfter)}`);
  await page.waitForTimeout(300);
}
console.log('\nRAM gates if the lag shrinks as RAM grows. If every lag is 0ms it is decorative.');
console.log('page errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
