// Load SCRAPHEART.html over file:// exactly as dom would: no server, no npm, no flags.
// ⚠ "It built" is not "it runs". Chrome treats file:// as an opaque origin and the
// failure mode for a module script there is a silent blank canvas.
import { chromium } from 'playwright';
import fs from 'node:fs';

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

const FILE = join(REPO, "SCRAPHEART.html");
if (!fs.existsSync(FILE)) { console.error('no SCRAPHEART.html'); process.exit(1) }

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 220)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) });
page.on('requestfailed', r => errs.push('requestfailed: ' + r.url().slice(0, 120)));

await page.goto('file:///' + FILE);
await page.waitForTimeout(2500);

const live = await page.evaluate(() => {
  const w = window.world;
  if (!w) return { booted: false };
  const c = document.getElementById('c');
  // is anything actually PAINTED, or is it a black rectangle?
  const g = c.getContext('2d');
  const px = g.getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 0; i < px.length; i += 4 * 97) if (px[i] + px[i+1] + px[i+2] > 40) lit++;
  return { booted: true, t: +w.t.toFixed(1), wrecks: w.wrecks.length,
           threats: w.threats.length, canvas: `${c.width}x${c.height}`,
           litSamples: lit, sampled: Math.floor(px.length / (4 * 97)) };
});
console.log('boot:', JSON.stringify(live));

// and does it actually play? drive it a little.
let played = { moved: 0, chassis: false };
if (live.booted) {
  await page.keyboard.down('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyD');
  played = await page.evaluate(() => ({
    moved: Math.round(Math.abs(world.player.x - 800)),
    chassis: !!world.chassis?.taken,
    t: +world.t.toFixed(1),
  }));
}
console.log('played:', JSON.stringify(played));
await page.screenshot({ path: join(SHOTS, "sf-singlefile.png") });

console.log('\n=== VERDICTS ===');
console.log('1. boots from file:// with no server:', live.booted ? 'PASS' : 'FAIL (world never appeared)');
console.log('2. it is actually drawing           :',
  live.litSamples > 20 ? `PASS (${live.litSamples}/${live.sampled} sampled pixels lit)` : `FAIL (${live.litSamples} lit ... blank canvas)`);
console.log('3. the sim is running               :', live.t > 1 ? `PASS (t=${live.t}s)` : `FAIL (t=${live.t})`);
console.log('4. input works                      :', played.moved > 30 ? `PASS (moved ${played.moved}px)` : `FAIL (${played.moved}px)`);
console.log('5. zero console noise               :', errs.length === 0 ? 'PASS' : `FAIL\n   ${errs.join('\n   ')}`);
await browser.close();
