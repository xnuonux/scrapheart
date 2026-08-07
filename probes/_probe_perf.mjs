// game-perf. The target is a mid-range Android, so measure one, not a desktop.
// Also: the touch controls have never once been exercised.
import { chromium, devices } from 'playwright';
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
await new Promise(r => server.listen(4712, r));
const out = SHOTS;
const browser = await chromium.launch();

const sample = async (page, label) => {
  const r = await page.evaluate(async () => {
    let n = 0; const t0 = performance.now(); const frames = [];
    let last = t0;
    await new Promise(res => { const f = () => { const now = performance.now();
      frames.push(now - last); last = now; n++;
      if (now - t0 < 3000) requestAnimationFrame(f); else res(null) }; requestAnimationFrame(f) });
    frames.sort((a,b)=>a-b);
    return { fps: Math.round(n / ((performance.now()-t0)/1000)),
             worstFrameMs: +frames[frames.length-1].toFixed(1),
             p95FrameMs: +frames[Math.floor(frames.length*0.95)].toFixed(1) };
  });
  console.log(`  ${label.padEnd(34)} ${r.fps}fps  p95 frame ${r.p95FrameMs}ms  worst ${r.worstFrameMs}ms`);
  return r;
};

// ── desktop, for the before/after on dust ──
{
  const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
  await page.goto('http://127.0.0.1:4712/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  console.log('=== desktop 1280x800 ===');
  await page.evaluate(() => { world.weather = null });
  await page.waitForTimeout(300);
  const clear = await sample(page, 'clear air');
  await page.evaluate(() => {
    world.weather = { x: world.player.x, y: world.player.y, r: 460, vx: 0, vy: 0,
                      kind: 'dust', strength: 1, age: 20, life: 9999 };
  });
  await page.waitForTimeout(400);
  const dust = await sample(page, 'inside dust (was 55-57fps)');
  console.log(`  delta: ${dust.fps - clear.fps}fps  (before the sprite cache it was about -4)`);
  await page.close();
}

// ── a mid-range phone, which is the actual target ──
const phone = devices['Pixel 5'];
{
  const ctx = await browser.newContext({ ...phone, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
  await page.goto('http://127.0.0.1:4712/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  console.log(`\n=== ${phone.viewport.width}x${phone.viewport.height} @${phone.deviceScaleFactor}x, touch, 4x CPU throttle ===`);

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.evaluate(() => { world.weather = null });
  await page.waitForTimeout(400);
  const mClear = await sample(page, 'clear air, throttled 4x');
  await page.evaluate(() => {
    world.weather = { x: world.player.x, y: world.player.y, r: 460, vx: 0, vy: 0,
                      kind: 'dust', strength: 1, age: 20, life: 9999 };
    world.player.x = 1400;                    // the deep: max threats + casters
    world.spawnTimer = 0;
  });
  await page.waitForTimeout(2500);
  const mDust = await sample(page, 'deep + dust + crowd, throttled 4x');

  // ── THE TOUCH CONTROLS, which have never once been exercised ──
  console.log('\n=== touch ===');
  const before = await page.evaluate(() => ({ x: Math.round(world.player.x), y: Math.round(world.player.y) }));
  // floating stick lives on the left half
  await page.touchscreen.tap(100, 500);
  const vp = phone.viewport;
  await page.evaluate(() => { window.__stick = () => ({ active: window.__input?.stick?.active }) });
  // drag the left thumb
  await page.mouse.move(100, 500);
  const drag = await page.evaluate(async () => {
    const c = document.getElementById('c');
    const send = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
    const p0 = { x: world.player.x, y: world.player.y };
    send('pointerdown', 1, 90, 500);
    for (let i = 0; i < 40; i++) { send('pointermove', 1, 90 + 60, 500); await new Promise(r => requestAnimationFrame(r)) }
    const moved = Math.round(Math.hypot(world.player.x - p0.x, world.player.y - p0.y));
    send('pointerup', 1, 150, 500);
    await new Promise(r => setTimeout(r, 120));
    const p1 = { x: world.player.x, y: world.player.y };
    await new Promise(r => setTimeout(r, 300));
    const drifted = Math.round(Math.hypot(world.player.x - p1.x, world.player.y - p1.y));
    return { moved, driftedAfterRelease: drifted };
  });
  console.log('  left-thumb stick:', JSON.stringify(drag));

  const firing = await page.evaluate(async () => {
    const c = document.getElementById('c');
    const send = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
    // ⚠ Sample DURING. The player sits at x=1400 firing east, so shots cross the world
    // edge and are culled long before a check at the end of the burst can see them. The
    // first version read 0 and called firing broken while heat sat at 0.97.
    world.player.heat = 0; world.player.overheated = 0;
    let peak = 0;
    send('pointerdown', 2, 330, 400);
    for (let i = 0; i < 40; i++) {
      peak = Math.max(peak, world.bullets.filter(b => b.from === 'player').length);
      await new Promise(r => requestAnimationFrame(r));
    }
    send('pointerup', 2, 330, 400);
    return { peakPlayerBullets: peak, heat: +world.player.heat.toFixed(2) };
  });
  console.log('  right-side fire:', JSON.stringify(firing));

  // pointercancel must release, or the player walks into a wall forever
  const cancel = await page.evaluate(async () => {
    const c = document.getElementById('c');
    const send = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
    send('pointerdown', 3, 90, 500);
    send('pointermove', 3, 150, 500);
    await new Promise(r => setTimeout(r, 200));
    send('pointercancel', 3, 150, 500);      // ⚠ the OS steals the touch
    await new Promise(r => setTimeout(r, 200));
    const p0 = { x: world.player.x, y: world.player.y };
    await new Promise(r => setTimeout(r, 500));
    return { stuckPx: Math.round(Math.hypot(world.player.x - p0.x, world.player.y - p0.y)) };
  });
  console.log('  after pointercancel:', JSON.stringify(cancel));

  await page.screenshot({ path: `${out}/p1-phone.png` });

  console.log('\n=== VERDICTS ===');
  console.log('1. dust no longer costs frames  :',
    Math.abs(mDust.fps - mClear.fps) <= 6 ? `PASS (${mClear.fps} -> ${mDust.fps}fps on a throttled phone)` : `FAIL (${mClear.fps} -> ${mDust.fps})`);
  // ⚠ core/loop CAPS touch devices at 33ms ("a locked 30 beats an oscillating 45, and
  // it roughly halves thermal load"). So the target here is 30, not 60, and measuring
  // against 60 would report the frame budget doing its job as a failure.
  console.log('2. holds the intended 30fps cap :',
    mDust.fps >= 26 ? `PASS (${mDust.fps}fps against a deliberate 30fps cap, in the worst case the game has)` : `FAIL (${mDust.fps}fps)`);
  console.log('3. no frame spikes over 100ms   :',
    mDust.worstFrameMs < 100 ? `PASS (worst ${mDust.worstFrameMs}ms)` : `FAIL (worst ${mDust.worstFrameMs}ms)`);
  console.log('4. touch stick moves the player :', drag.moved > 40 ? `PASS (${drag.moved}px)` : `FAIL (${drag.moved}px)`);
  console.log('5. release stops the player     :', drag.driftedAfterRelease < 6 ? `PASS (${drag.driftedAfterRelease}px drift)` : `FAIL (${drag.driftedAfterRelease}px)`);
  console.log('6. right side fires             :',
    firing.peakPlayerBullets > 0 && firing.heat > 0.3
      ? `PASS (peak ${firing.peakPlayerBullets} in flight, heat rose to ${firing.heat})` : `FAIL (${JSON.stringify(firing)})`);
  console.log('7. 🚨 pointercancel releases    :', cancel.stuckPx < 6 ? `PASS (${cancel.stuckPx}px)` : `FAIL (input stuck ON, player drifted ${cancel.stuckPx}px)`);
  console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
}
await browser.close(); server.close();
