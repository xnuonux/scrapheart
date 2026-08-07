// The P0 gate is "seven name the companion UNPROMPTED". So: is naming possible, and is
// it possible WITHOUT the game having asked?
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
await new Promise(r => server.listen(4713, r));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0,200)));
page.on('dialog', async d => { await d.accept('BUCKET') });
await page.goto('http://127.0.0.1:4713/', { waitUntil: 'networkidle' });
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
    await page.waitForTimeout(140);
    for (const k of keys) await page.keyboard.up(k);
  }
};
await walkTo(() => world.chassis?.taken ? null
  : { dx: world.chassis.x - world.player.x, dy: world.chassis.y - world.player.y });
await page.waitForTimeout(600);

// 1 · nothing on screen asks
const asks = await page.evaluate(() => {
  const txt = document.body.innerText.toLowerCase();
  const begging = ['give it a name', 'name it', 'name your', 'call it something', 'choose a name'];
  return { hits: begging.filter(b => txt.includes(b)),
           buttons: [...document.querySelectorAll('button')].map(b => b.innerText.trim()).filter(Boolean),
           hint: document.getElementById('hint')?.innerText ?? '' };
});
console.log('on-screen text that asks for a name:', JSON.stringify(asks.hits));
console.log('buttons present:', JSON.stringify(asks.buttons));
console.log('key hint line:', JSON.stringify(asks.hint));

// 2 · it is still possible
await page.keyboard.press('KeyI');
await page.waitForTimeout(500);
const field = await page.evaluate(() => {
  const el = document.getElementById('compname');
  return el ? { present: true, text: el.innerText.trim(), tag: el.tagName } : { present: false };
});
console.log('name field in the pack panel:', JSON.stringify(field));

const before = await page.evaluate(() => ({ name: world.companion.name, named: world.companion.named }));
await page.locator('#compname').click();
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({ name: world.companion.name, named: world.companion.named,
                                           log: world.logs[0]?.text }));
console.log('after clicking it:', JSON.stringify(after));

// 3 · and it persists into the HUD and the death record
const persists = await page.evaluate(() => {
  world.player.hp = -1;
  return null;
});
await page.waitForTimeout(600);
const survived = await page.evaluate(() => world.waiting?.c?.name ?? null);
console.log('name after death:', JSON.stringify(survived));

console.log('\n=== VERDICTS ===');
console.log('1. 🚨 the game never asks       :',
  asks.hits.length === 0 && asks.buttons.length === 0
    ? 'PASS (no prompting copy, no buttons at all)' : `FAIL (${JSON.stringify(asks.hits)} ${JSON.stringify(asks.buttons)})`);
console.log('2. the key hint does not hint it:',
  !/name/i.test(asks.hint) ? `PASS ("${asks.hint}")` : `FAIL ("${asks.hint}")`);
console.log('3. naming is still possible     :',
  field.present && after.name === 'BUCKET' ? `PASS (unlabelled field, reads "${field.text}" until used)` : `FAIL (${JSON.stringify(field)} -> ${JSON.stringify(after)})`);
console.log('4. it is where you assemble it  :', field.present ? 'PASS (in the pack panel)' : 'FAIL');
console.log('5. the name outlives the player :', survived === 'BUCKET' ? 'PASS' : `FAIL (${survived})`);
console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await page.screenshot({ path: join(SHOTS, "n1-naming.png") });
await browser.close(); server.close();
