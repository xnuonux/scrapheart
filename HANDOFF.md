# HANDOFF · resume SCRAPHEART on another machine

Written 2026-08-07 so a fresh instance on the beast PC can pick this up cold and lose
nothing. Read this first, then `NEXT.md`, then the design canon.

---

## the one question this project exists to answer

> **Ten players. One hour. Single-player.**
> **Seven name the companion unprompted, and react when it is badly hurt.**
> ⚠ **If it fails, stop the project.**

🚨 **Do not tell a tester they can name it.** The name field is deliberately unlabelled.
Mention it and that player no longer counts toward the seven.

---

## what is here

| path | what it is |
|---|---|
| `src/` | 🚨 **the reference implementation.** TypeScript, canvas, playable. Every measured number was established here |
| `SCRAPHEART.html` | the whole game as one 52 kB file. double-click it, no install |
| `probes/` | **26 headless playwright probes.** the measurement apparatus. these are why the tuning is trustworthy |
| `tools/reachability.mjs` | asks whether every declared thing is actually DRIVEN |
| `tools/pack-single-file.mjs` | rebuilds `SCRAPHEART.html` |
| `godot/` | the port target. Godot 4.7, `scripts/tuning.gd` holds every measured number |
| `godot/tests/parity.gd` | 🚨 **proves the port reproduces the web build's figures.** 17/17 |
| `NEXT.md` | the build log: what is done, what is left, and **every mistake, with its receipt** |

## running it

```bash
npm install
npm run dev          # vite
npm run check        # tsc --noEmit
npm run build        # dist/
npm run pack         # SCRAPHEART.html ... re-run after ANY src change
node tools/reachability.mjs
node probes/_probe_gate.mjs      # any probe, they are self-contained
```

```bash
# godot 4.7 ... winget install GodotEngine.GodotEngine
godot --headless --path godot --import                      # build the class cache FIRST
godot --headless --path godot --script res://tests/parity.gd # 17/17 or the port is wrong
godot --path godot -- --shots                                # drive it and capture frames
```

⚠ **`--import` before anything else on a fresh clone**, or `class_name` lookups fail and
every script reports "Identifier not declared".

---

## 🚨 the four rules this codebase was built by

These are not style preferences. Each one is here because breaking it cost real time.

**1 · A typechecker proves the pieces FIT. It cannot prove any of them MOVE.**
Four bugs in one night shared this shape and not one threw, logged, or failed a check:
`p.retreating` assigned `false` forever so covering never ran · `degradeOnRemoval`
written, exported, correct, never called · `drawCompanion(hurt)` passed a literal `0`
since the first commit · `can.mark` granted and read nowhere. **Run
`tools/reachability.mjs`.**

**2 · A red probe is a claim about which of the two is stale, and it is not always the
code.** Five probes here have failed while the game was right: encoding a contract the
design had moved past, installing into a slot shape forbids, measuring a bot's patience,
checking for the wrong log string, or testing a scenario the game never produces.

**3 · Test the CLAIM, not the journey to it.** A bot dying to a warden proves the bot
cannot dodge, and nothing about whether a warden one-shots a handler.

**4 · A single green run is not evidence when the failure mode is variance.** The heart
moment measured 21px (pass) then 161px (fail) on identical code. Anything emergent gets
run three times before it counts.

---

## where the design lives

`IND-34` and `IND-34a` … `IND-34o` in the **blueprints** repo, `blueprints/independent/`.
The code defers to them: where code and doc disagree, **the doc is right and the code is
a bug.**

Two you should read before touching anything:

- **`IND-34n`** — the RotMG calibration, pulled from a real install. Its headline: time
  to die is a **designed constant** (~5 hits), because health and enemy damage both scale
  5x across a character. **Progression buys access, never safety.**
- **`IND-34o`** — dom's production rulings. Godot, Steam + both mobile stores, three
  visual registers layered by distance, fluid animation with the companion procedural,
  and a full Scatter history written for us and never shown to the player.

---

## 🚨 THE GODOT PORT IS THE GAME NOW (2026-08-25, beast-PC autonomous arc)

Dom pointed production at the beast PC and said make it a full-fledged indie game. The
port happened in measured phases, each with receipts, each pushed:

| phase | what landed | receipt |
|---|---|---|
| renderer foundation | `godot/render/` ... palette (the one place a hex may live), sprites on the web build's LCG, glows rasterised-once, vignette as a fragment shader, `field.tscn` | frames read |
| the world port | `godot/scripts/world.gd` ... the whole reference world, **both damage doors born singular** (the immortal class cannot exist here) | `tests/world_sim.gd`, 40+ claims clean |
| the art pass | shader floor (cracked earth, colder east), pooled 2D lights, soft shadows, motivated particles, film-grain haze, procedural sfx (10 voices, pitch-jittered, M mutes), JetBrains Mono (OFL, vendored) | parity clean |
| IND-34o registers | far colossi beyond the world edges at 35% parallax; companion legs derived from installed fragments; runner gait; warden sway; handler antenna + blink; touch layer (web scheme exactly) | frames read, 3 parallax iterations |
| the bestiary | loops (burn out, shedding themselves) · scavengers (TAKE a fragment, run it glowing, floor-proven both ways) · herders · pests · drays · warden degrees 3+4 | world sim + soak |
| the storyline | the dormant one that says "return." · repair unit free forever · foreman whose manifest ENDS it · commissary's invented rate · THE STILL in rows, whole fragments, uncommented · the waiting dog (34l #2) · buried salvage found only by curious companions · THE DOOR, passable at 3 fragments, last line = first line spoken back | 8+8 storyline claims in the sim |
| feel + ship | pickup magnetism (radius stays honest), camera lookahead, contact damage on a rhythm, **`dist-scrapheart/SCRAPHEART.exe` (105MB, boots clean)** | `tests/soak_deep.gd`: a stationary bot deep dies exactly once in 90s, worst hit 21.9 |

**Run it:** `godot --path godot` (main scene is the game) · `-- --shots` (capture frames) ·
`-- --play` (the end-to-end scene playtest: 5 checks, the whole first act + the fifth ending).
**Tests:** `world_sim.gd` (the world) · `parity.gd` (the mind vs the measurements) ·
`soak_deep.gd` (the balance).

### what remains, honestly

1. **The gate.** Ten players, one hour, seven name the companion unprompted. The web build
   (`SCRAPHEART.html`) is still the cheapest gate instrument and the gate is platform-independent.
2. **The hand-crafted art pass is real art time.** Everything procedural now satisfies the
   silhouette language; IND-34o's "fluid, hand-crafted" register for handler/warden/world is an
   artist's job layered on a working base.
3. **The voice** (34q): ship SILENT first. The methodological warning is absolute ... a talking
   companion inflates the naming gate. Run the gate on the silent build.
4. **Lending P1** (async, REST, bot borrowers honestly labelled). The guardrail: dispositions
   never change in another player's world.
5. **Android export** needs the android templates + SDK; the preset story for Windows is in
   `export_presets.cfg` (custom_template points at the extracted 4.7.1 tpz; move to AppData when
   the shell allows).

---

## what is left (web-build era, preserved)

**Everything buildable from the spec is built.** What remains needs a human, a phone, or
ten strangers:

1. **`HANDLER_GRACE` = 8 minutes** is the only number here a measurement does not own.
   ⚠ Watch a real person: if the dog still feels like a device when the warden arrives,
   this is too small, and it is the only thing that needs changing.
2. **Real-device thermal.** An emulated Pixel 5 under 4x throttle holds the intended
   30fps cap, but emulation cannot tell you whether minute ten is still 30fps in a hand
   that has got hot.
3. **The gate itself.**
4. **The Godot port proper** — `godot/` has the mind, the tuning and a parity test. The
   renderer, the world and the art direction from `IND-34o` are the work.
5. **`can.mark` surface** — implemented as a facing, but `IND-34c` forbids both a UI
   marker and dialogue, so how legible it should be is a design call.

### what a watcher should look for, in priority order

- **Do they name it?** Unprompted, without being told. That is the gate.
- **Do they go back for it after they die?**
- **Does the first loss land, or read as cruelty?** ⚠ Dying during that beat costs the
  dog *and* the machine in the same minute. Highest-risk moment in the build.
- **Does anyone repair it under fire?** If nobody does, interposition never fires.
- **Does anyone stop at something worth nothing?**

🌙
