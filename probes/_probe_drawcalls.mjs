// fps on this machine is unusable tonight: five samples of an IDENTICAL clear-air scene
// ranged 17 to 41. So verify the optimisation deterministically instead ... count the
// actual canvas work per frame, which does not care how loaded the box is.
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
await new Promise(r => server.listen(4722, r));
const browser = await chromium.launch();

const run = async (label, opts) => {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  // count canvas ops + the PIXELS they cover, before the game boots
  await page.addInitScript(() => {
    window.__ops = { drawImage: 0, fill: 0, gradPx: 0, imgPx: 0, frames: 0 };
    const P = CanvasRenderingContext2D.prototype;
    const di = P.drawImage;
    P.drawImage = function (...a) { window.__ops.drawImage++;
      if (a.length >= 5) window.__ops.imgPx += Math.abs(a[3] * a[4]);
      return di.apply(this, a) };
    const cg = P.createRadialGradient;
    P.createRadialGradient = function (...a) { window.__ops.grad = (window.__ops.grad||0)+1; return cg.apply(this, a) };
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) { return raf(function (t) { window.__ops.frames++; return cb(t) }) };
  });
  await page.goto('http://127.0.0.1:4722/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    world.player.x = 1400; world.player.y = 600; world.spawnTimer = 9999; world.bullets = [];
    for (let i = 0; i < 6; i++) world.spawnThreat();
  });
  await page.waitForTimeout(700);

  const take = async (dust) => {
    await page.evaluate((dust) => {
      const p = world.player;
      world.weather = dust ? { x: p.x, y: p.y, r: 460, vx: 0, vy: 0, kind: 'dust',
                               strength: 1, age: 20, life: 9999 } : null;
      window.__ops.drawImage = 0; window.__ops.imgPx = 0;
      window.__ops.grad = 0; window.__ops.frames = 0;
    }, dust);
    await page.waitForTimeout(2000);
    return page.evaluate(() => {
      const o = window.__ops;
      return { perFrame: +(o.drawImage / Math.max(1, o.frames)).toFixed(2),
               mpxPerFrame: +((o.imgPx / Math.max(1, o.frames)) / 1e6).toFixed(2),
               gradsPerFrame: +((o.grad ?? 0) / Math.max(1, o.frames)).toFixed(3),
               frames: o.frames };
    });
  };
  const clear = await take(false);
  const dust  = await take(true);
  console.log(`\n=== ${label} ===`);
  console.log(`  clear air : ${clear.perFrame} drawImage/frame, ${clear.mpxPerFrame} Mpx/frame, ${clear.gradsPerFrame} gradients/frame`);
  console.log(`  in dust   : ${dust.perFrame} drawImage/frame, ${dust.mpxPerFrame} Mpx/frame, ${dust.gradsPerFrame} gradients/frame`);
  console.log(`  dust adds : ${(dust.perFrame-clear.perFrame).toFixed(2)} blits, ${(dust.mpxPerFrame-clear.mpxPerFrame).toFixed(2)} Mpx of alpha fill per frame`);
  await ctx.close();
  return { clear, dust };
};

const desktop = await run('DESKTOP (5 bands)', { viewport: { width: 1280, height: 800 } });
const phone   = await run('PHONE, coarse pointer (1 band)', { ...devices['Pixel 5'], hasTouch: true, isMobile: true });

console.log('\n=== VERDICTS ===');
// ⚠ was 16/frame in CLEAR AIR before any of this was cached. The dust was never the
// expensive part; the ordinary background glow of the world was, all the time.
console.log('1. gradients per frame, clear air (was 16):',
  desktop.clear.gradsPerFrame < 0.05
    ? `PASS (${desktop.clear.gradsPerFrame}/frame desktop, ${phone.clear.gradsPerFrame} phone)`
    : `FAIL (${desktop.clear.gradsPerFrame}/frame)`);
console.log('2. mobile draws fewer dust blits than desktop      :',
  phone.dust.perFrame < desktop.dust.perFrame
    ? `PASS (${phone.dust.perFrame} vs ${desktop.dust.perFrame} per frame)` : `FAIL (${phone.dust.perFrame} vs ${desktop.dust.perFrame})`);
const phoneAdd = phone.dust.mpxPerFrame - phone.clear.mpxPerFrame;
const deskAdd  = desktop.dust.mpxPerFrame - desktop.clear.mpxPerFrame;
console.log('3. and much less alpha fill                        :',
  phoneAdd < deskAdd * 0.6 ? `PASS (${phoneAdd.toFixed(2)} vs ${deskAdd.toFixed(2)} Mpx/frame, ${(100-100*phoneAdd/deskAdd).toFixed(0)}% less)`
                           : `FAIL (${phoneAdd.toFixed(2)} vs ${deskAdd.toFixed(2)})`);
await browser.close(); server.close();
