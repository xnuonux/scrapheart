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

await new Promise(r => server.listen(4700, r));

const out = SHOTS;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0,220)));
page.on('console', m => { if (m.type()==='error') errs.push('console: '+m.text().slice(0,180)) });

await page.goto('http://127.0.0.1:4700/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/sh-start.png` });

const read = () => page.evaluate(() => ({
  hp: Math.round(world.player.hp),
  threats: world.threats.filter(t=>t.alive).length,
  salvage: world.salvage.length,
  pack: world.pack.length,
  comp: world.companion ? {
    beh: world.companion.behaviour, warm: [...world.companion.warm], ram: world.companion.body.ram,
    frags: world.companion.liveFragments.map(f=>f.name), empty: world.companion.emptySockets,
    loyalty: +world.companion.loyalty.toFixed(2), caution: +world.companion.caution.toFixed(2),
    charge: +world.companion.charge.toFixed(2),
  } : null,
  chassisTaken: world.chassis?.taken,
  interestSeen: world.interest.filter(i=>i.seen).length,
  logs: world.logs.map(l=>l.text),
}));

console.log('--- t=1s ---'); console.log(JSON.stringify(await read(), null, 1));

// walk to the chassis, steering rather than dead-reckoning
console.log('\nwalking to the chassis...');
const startT = Date.now();
while (Date.now() - startT < 14000) {
  const st = await page.evaluate(() => world.chassis?.taken
    ? null
    : { dx: world.chassis.x - world.player.x, dy: world.chassis.y - world.player.y });
  if (!st) break;
  const keys = [];
  if (st.dx > 12) keys.push('KeyD'); else if (st.dx < -12) keys.push('KeyA');
  if (st.dy > 12) keys.push('KeyS'); else if (st.dy < -12) keys.push('KeyW');
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(200);
  for (const k of keys) await page.keyboard.up(k);
}
await page.waitForTimeout(500);
console.log('time to chassis:', ((Date.now()-startT)/1000).toFixed(1) + 's');

let s = await read();
console.log('chassis taken:', s.chassisTaken, '| companion:', s.comp ? 'ALIVE' : 'none');
if (s.comp) console.log('  ', JSON.stringify(s.comp));
await page.screenshot({ path: `${out}/sh-companion.png` });

// fight + move for a while, see the companion behave
console.log('\nplaying 25s...');
for (let i=0;i<25;i++){
  const k = ['KeyW','KeyA','KeyS','KeyD'][i%4];
  await page.keyboard.down(k);
  await page.mouse.move(700+Math.sin(i)*200, 400+Math.cos(i)*150);
  await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
  await page.waitForTimeout(600);
  await page.keyboard.up(k);
}
s = await read();
console.log(JSON.stringify(s, null, 1));
await page.screenshot({ path: `${out}/sh-play.png` });

// install a fragment via the pack UI
console.log('\ninstalling a fragment...');
await page.keyboard.press('KeyI');
await page.waitForTimeout(500);
const frags = await page.locator('.frag').count();
console.log('pack entries visible:', frags);
if (frags > 0) {
  await page.locator('.frag').first().click();
  await page.waitForTimeout(200);
  const emptySlot = page.locator('.slot.empty').first();
  if (await emptySlot.count()) { await emptySlot.click(); await page.waitForTimeout(400); }
}
await page.screenshot({ path: `${out}/sh-pack.png` });
s = await read();
console.log('after install:', s.comp ? JSON.stringify({frags:s.comp.frags, empty:s.comp.empty, loyalty:s.comp.loyalty, ram:s.comp.ram}) : 'no comp');

// perf
const perf = await page.evaluate(async () => {
  let n=0; const t0=performance.now();
  await new Promise(r=>{ const f=()=>{ n++; if(performance.now()-t0<2000) requestAnimationFrame(f); else r(null) }; requestAnimationFrame(f) });
  return Math.round(n / ((performance.now()-t0)/1000));
});
console.log('\nfps (headless, 2s sample):', perf);
console.log('page errors:', errs.length ? errs.join(' | ') : 'none');

await browser.close(); server.close();
