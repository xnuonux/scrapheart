#!/usr/bin/env node
// REACHABILITY · is every declared thing actually driven?
//
// 🚨 THE REASON THIS EXISTS. In one night this codebase produced four bugs of the same
// shape, and not one of them threw, logged, or failed a typecheck:
//
//   · `p.retreating` was assigned false every frame and set true NOWHERE, so `s.cover`
//     scored zero forever and COVERING ... which 34c calls the entire emotional engine of
//     this game ... had never once run.
//   · `degradeOnRemoval` was written, exported, correct, and never called, because
//     nothing could remove a fragment at all.
//   · `drawCompanion(hurt)` was passed a literal 0 since the first commit, so the damage
//     state the whole P0 gate depends on was never drawn.
//   · `can.mark` is granted by SURVEY OPTIC and read by nothing.
//
// ⚠ Every one of those reads as a finished feature in a diff. A typechecker proves the
// pieces FIT; it cannot prove any of them MOVE. This asks the other question.
//
//   node tools/reachability.mjs           # report, exit 1 if anything is dead
//   node tools/reachability.mjs --warn     # report, always exit 0
//
// ⚠ Keep this after the Godot port. The language changes; the failure mode does not.

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const SRC = 'C:/dev/scrapheart/src';
const WARN = process.argv.includes('--warn');

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (['.ts', '.tsx'].includes(extname(e.name))) out.push(p);
  }
  return out;
}
const files = walk(SRC);
const ALL = files.map(f => ({ f, src: readFileSync(f, 'utf8') }));
const whole = ALL.map(a => a.src).join('\n');
// code with comments stripped, so prose ABOUT a thing never counts as a use of it
const code = whole.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const dead = [];
const ok = [];
const DEAD = (kind, name, why) => dead.push({ kind, name, why });
const OK = (kind, name, note) => ok.push({ kind, name, note });

// ── 1 · every BEHAVIOUR must be choosable ────────────────────────────────────
// a behaviour that is scored but never assignable, or assignable but never acted on,
// is a mind with a room it can never enter.
{
  const listed = (whole.match(/export const BEHAVIOURS[^=]*=\s*\[([^\]]*)\]/) ?? [])[1] ?? '';
  const behaviours = [...listed.matchAll(/'(\w+)'/g)].map(m => m[1]);
  for (const b of behaviours) {
    const scored = new RegExp(`s\\.${b}\\s*=`).test(code);
    // ⚠ a behaviour can be acted on by an explicit case, by a comparison, or by being the
    // documented DEFAULT of the switch. the third is legitimate but must be declared as
    // such in the code, or a reader has to infer it from an absence.
    const acted  = new RegExp(`case '${b}'`).test(code)
                || new RegExp(`behaviour === '${b}'`).test(code)
                || new RegExp(`default:[^}]*\\b${b}\\b`).test(code)
                || new RegExp(`//\\s*BEHAVIOUR-DEFAULT:\\s*${b}`).test(whole);
    if (!scored) DEAD('behaviour', b, 'never scored ... it can never be chosen');
    else if (!acted) DEAD('behaviour', b, 'scored but never acted on ... choosing it does nothing');
    else OK('behaviour', b, 'scored and acted');
  }
}

// ── 2 · every CAPABILITY granted must be read ────────────────────────────────
{
  const grants = new Set([...whole.matchAll(/grants:\s*\[([^\]]*)\]/g)]
    .flatMap(m => [...m[1].matchAll(/'(\w+)'/g)].map(x => x[1])));
  for (const g of grants) {
    const read = new RegExp(`can\\.${g}\\b`).test(code);
    if (!read) DEAD('capability', g, `granted by a fragment and \`can.${g}\` is read nowhere`);
    else OK('capability', g, 'read by the scorer or the actor');
  }
}

// ── 3 · every FRAGMENT must be able to reach the world ───────────────────────
{
  const cat = (whole.match(/CATALOGUE[\s\S]*?\n\]/) ?? [''])[0];
  const ids = [...cat.matchAll(/id:\s*'(\w+)'/g)].map(m => m[1]);
  // where can a fragment come from? a placed salvage id, the drop pool, or a hard-coded drop
  const pool = (whole.match(/FRAG_POOL\s*=\s*\[([^\]]*)\]/) ?? [])[1] ?? '';
  const inPool = new Set([...pool.matchAll(/'(\w+)'/g)].map(m => m[1]));
  for (const id of ids) {
    const placed = new RegExp(`frag:\\s*'${id}'`).test(code)
                || new RegExp(`\\bmakeFragment\\('${id}'`).test(code)
                || new RegExp(`\\['[^\\]]*'${id}'`).test(code)
                || new RegExp(`'${id}'`).test(code.replace(cat, ''));   // referenced outside the catalogue
    if (!inPool.has(id) && !placed) DEAD('fragment', id, 'in the catalogue, in no drop pool, and placed nowhere ... unobtainable');
    else OK('fragment', id, inPool.has(id) ? 'in the drop pool' : 'placed in the world');
  }
}

// ── 4 · every SOUND must have a trigger ──────────────────────────────────────
{
  const block = (whole.match(/export const sfx\s*=\s*\{([\s\S]*?)\n\}/) ?? [])[1] ?? '';
  const cues = [...block.matchAll(/^\s*(\w+):/gm)].map(m => m[1]);
  for (const c of cues) {
    const played = new RegExp(`sfx\\.${c}\\s*\\(`).test(code.replace(block, ''));
    if (!played) DEAD('sound', c, 'defined and never played');
    else OK('sound', c, 'triggered');
  }
}

// ── 5 · every BODY stat must be read ─────────────────────────────────────────
{
  const iface = (whole.match(/export interface Body\s*\{([\s\S]*?)\n\}/) ?? [])[1] ?? '';
  const stats = [...iface.matchAll(/^\s*(\w+):\s*number/gm)].map(m => m[1]);
  for (const s of stats) {
    // ⚠ v1 looked for `body.X` and missed every helper that takes a Body under another
    // name ... `socketCount(b) => b.sockets + b.auxSockets` read it and the check called
    // it dead. count ANY property access, minus the interface declaration itself.
    const uses = [...code.matchAll(new RegExp(`\\.${s}\\b`, 'g'))].length;
    if (uses === 0) DEAD('body-stat', s, `declared on Body and \`.${s}\` is read nowhere`);
    else OK('body-stat', s, `${uses} use(s)`);
  }
}

// ── 6 · 🚨 THE RETREATING CLASS: a field written to only ONE constant ────────
// the shape that cost this build its covering system. a boolean that is only ever
// assigned `false`, or a parameter only ever passed `0`, is a feature that does not exist.
// ⚠ THE DETECTOR ITSELF HAD THIS BUG. v1 scanned assignments PER FILE and ignored object
// literals, so `t.alive = false` looked dead when it is initialised `alive: true` in a
// literal one line away, and `c.swapCd = 0` looked dead because `c.swapCd = 1` lives in a
// different file. A dead-code detector that cries wolf gets muted, which makes it worse
// than nothing. Values are now unioned across EVERY file and across literals too.
{
  // property -> every distinct value it is ever given, anywhere, by any route
  const values = new Map();
  const add = (prop, v) => { (values.get(prop) ?? values.set(prop, new Set()).get(prop)).add(v.trim()) };
  for (const { src } of ALL) {
    const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    // ⚠ v2 of this regex missed two whole classes and produced a page of false alarms:
    //   · COMPOUND assignment ... `w.t += dt` is how `t` is actually driven
    //   · CHAINED access ... `this.chassis.taken = true` failed the leading-delimiter test,
    //     because the character before `chassis` is a dot
    // a plain `=` is matched only when it is not part of ==, ===, !=, <=, >=, +=, etc.
    for (const m of clean.matchAll(/\.(\w+)\s*(?<![=!<>+\-*/])=(?!=)\s*([^;\n]+)/g)) add(m[1], m[2]);
    for (const m of clean.matchAll(/\.(\w+)\s*(?:\+=|-=|\*=|\/=|\|\|=|\?\?=)\s*([^;\n]+)/g)) add(m[1], '<compound>');
    for (const m of clean.matchAll(/\.(\w+)(?:\+\+|--)/g)) add(m[1], '<compound>');
    for (const m of clean.matchAll(/(?:^|[{,\s])(\w+)\s*:\s*(true|false|-?[\d.]+)\s*[,}\n]/g)) add(m[1], m[2]);
    // ⚠ a literal whose value is COMPUTED still drives the property. `{ ...f, degradation:
    // Math.min(1, ...) }` was invisible to the constant-matcher above, so `degradation`
    // looked frozen at 0 while the socket economy was demonstrably wearing fragments out.
    for (const m of clean.matchAll(/(?:^|[{,\s])(\w+)\s*:\s*(?!true|false|-?[\d.]+\s*[,}\n])([^,\n}]+)/g))
      add(m[1], '<computed>');
    // ⚠ DYNAMIC KEYS. `this.can[g] = true` writes a property whose NAME is not in the
    // source, so every key of that map reads as write-once. find the bracket-written
    // container, then mark the keys of its literal as driven.
    for (const b of clean.matchAll(/(?:\.|\b)(\w+)\s*\[[^\]]+\]\s*(?<![=!<>])=(?!=)/g)) {
      const container = b[1];
      for (const lit of clean.matchAll(new RegExp(`\\b${container}\\s*[:=]\\s*\\{([^}]*)\\}`, 'g')))
        for (const k of lit[1].matchAll(/(\w+)\s*:/g)) add(k[1], '<computed>');
    }
    // a class field: `retreating = false` / `swapCd = 0`
    for (const m of clean.matchAll(/^\s{2}(\w+)\s*=\s*(true|false|-?[\d.]+)\s*$/gm)) add(m[1], m[2]);
  }
  const CONST = /^(true|false|0)$/;
  for (const [prop, vals] of values) {
    if (vals.size !== 1) continue;
    const only = [...vals][0];
    if (!CONST.test(only)) continue;
    // and it must be READ somewhere, or it is merely unused rather than a lie
    const reads = [...code.matchAll(new RegExp(`\\.${prop}\\b`, 'g'))].length;
    const writes = [...code.matchAll(new RegExp(`\\.${prop}\\s*=`, 'g'))].length;
    if (reads - writes <= 0) continue;
    DEAD('constant-write', prop,
      `every assignment and initialiser gives it \`${only}\`, and ${reads - writes} place(s) READ it. ` +
      `this is the exact shape that made COVERING dead for the life of the project.`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
const group = xs => xs.reduce((m, x) => ((m[x.kind] ??= []).push(x), m), {});

console.log('');
for (const [kind, xs] of Object.entries(group(ok))) {
  console.log(`\x1b[32m✓\x1b[0m ${kind.padEnd(14)} ${xs.length} reachable`);
}
if (dead.length) {
  console.log('\n\x1b[31m\x1b[1m── DEAD ──\x1b[0m  declared, and nothing drives it\n');
  for (const [kind, xs] of Object.entries(group(dead))) {
    console.log(`\x1b[1m${kind}\x1b[0m`);
    for (const x of xs) console.log(`  ${x.name.padEnd(16)} ${x.why}`);
    console.log('');
  }
  console.log(`\x1b[31m${dead.length} thing${dead.length === 1 ? '' : 's'} that read as shipped and do nothing.\x1b[0m\n`);
  process.exit(WARN ? 0 : 1);
}
console.log('\n\x1b[32mreachability: clean\x1b[0m  every behaviour, capability, fragment, cue and stat is driven by something.\n');
