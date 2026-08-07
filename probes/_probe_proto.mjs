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

const out = SHOTS;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1320, height: 780 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });

await page.goto('file:///C:/dev/scrapheart-proto/two-companions.html');
await page.waitForTimeout(1500);

// let it run and spawn pressure
for (let i = 0; i < 8; i++) { await page.keyboard.press('e'); await page.waitForTimeout(120); }
await page.waitForTimeout(2500);

const read = async () => page.evaluate(() => ({
  a: { name: comps[0].name, beh: comps[0].behaviour, warm: [...comps[0].warm], ram: comps[0].ram },
  b: { name: comps[1].name, beh: comps[1].behaviour, warm: [...comps[1].warm], ram: comps[1].ram },
  threats: threats.length, loot: loot.length, hp: Math.round(player.hp),
}));

console.log('--- loyal + cautious, under pressure ---');
let s = await read();
console.log(`${s.a.name}: ${s.a.beh.padEnd(12)} warm=[${s.a.warm.join(',')}]`);
console.log(`${s.b.name}: ${s.b.beh.padEnd(12)} warm=[${s.b.warm.join(',')}]`);
console.log(`threats=${s.threats} loot=${s.loot} playerHP=${s.hp}`);
console.log('DIVIDED ROLES:', s.a.beh !== s.b.beh ? 'YES' : 'no (same behaviour)');
await page.screenshot({ path: `${out}/proto-loyal-cautious.png` });

// sample divergence over time
let diverged = 0, samples = 0;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(250);
  const r = await read();
  samples++; if (r.a.beh !== r.b.beh) diverged++;
}
console.log(`\ndivergence over ${samples} samples: ${diverged} (${Math.round(diverged/samples*100)}% of the time doing different things)`);

// does RAM actually drop behaviours?
const dropTest = await page.evaluate(() => {
  const c = comps.find(x => x.ram <= 3) || comps[0];
  return { name: c.name, ram: c.ram, warmCount: c.warm.size, totalBehaviours: Object.keys(c.scores).length };
});
console.log(`RAM gate: ${dropTest.name} ram=${dropTest.ram} holding ${dropTest.warmCount} of ${dropTest.totalBehaviours} behaviours warm`);
console.log('DROPS BEHAVIOURS:', dropTest.warmCount < dropTest.totalBehaviours ? 'YES' : 'NO');

// mismatched preset
await page.click('[data-p="mismatched"]');
await page.waitForTimeout(300);
for (let i = 0; i < 8; i++) { await page.keyboard.press('e'); await page.waitForTimeout(100); }
await page.waitForTimeout(2500);
let d2 = 0;
for (let i = 0; i < 30; i++) { await page.waitForTimeout(220); const r = await read(); if (r.a.beh !== r.b.beh) d2++; }
console.log(`\n--- mismatched ---`);
s = await read();
console.log(`${s.a.name}: ${s.a.beh}   |   ${s.b.name}: ${s.b.beh}`);
console.log(`divergence: ${d2}/30 (${Math.round(d2/30*100)}%)`);
await page.screenshot({ path: `${out}/proto-mismatched.png` });

// two reckless (control: should duplicate, not divide)
await page.click('[data-p="twoReckless"]');
await page.waitForTimeout(300);
for (let i = 0; i < 8; i++) { await page.keyboard.press('e'); await page.waitForTimeout(100); }
await page.waitForTimeout(2000);
let d3 = 0;
for (let i = 0; i < 30; i++) { await page.waitForTimeout(220); const r = await read(); if (r.a.beh !== r.b.beh) d3++; }
console.log(`\n--- two reckless (control) ---`);
console.log(`divergence: ${d3}/30 (${Math.round(d3/30*100)}%)`);

const logLines = await page.evaluate(() => logLines.slice(0, 10).map(l => l.msg.replace(/<[^>]+>/g, '')));
console.log('\n--- event log ---');
logLines.forEach(l => console.log('  ' + l));

console.log('\npage errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
