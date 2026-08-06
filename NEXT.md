# P0 build log

**The gate** (`IND-34-BRIEF`): ten players, one hour, single-player. **Seven name the companion
unprompted and react when it is badly hurt.** And it must beat a stateless drone's felt absence,
which COREBOUND already achieves. ⚠ **If it fails, stop the project.**

Everything below exists only to make that gate answerable.

---

## done

- [x] fixed timestep + interpolated render, hidden-tab guard, mobile frame budget (`core/loop`)
- [x] intent layer: keyboard, mouse, floating touch stick, `pointercancel` handled (`core/input`)
- [x] seeded RNG (law 7)
- [x] procedural SFX, pitch-randomised, voice-limited, mobile unlock, persisted mute (`audio/sfx`)
- [x] the palette, one file, never deviated from (`render/palette`)
- [x] procedural machine sprites from a seed, silhouette-first (`render/sprites`)
- [x] camera lerp + trauma shake, vignette, warm-light exceptions (`render/draw`)
- [x] fragment catalogue, install, degradation-on-removal, wear resistance (`game/fragments`)
- [x] the companion: utility scorer, RAM-limited warm set, battery, autonomous act (`game/companion`)
- [x] THE HALT: wrecks, salvage, chassis, threats with telegraphs, things worth nothing (`game/world`)
- [x] heat instead of ammo, overheat lock
- [x] pack + socket UI, install by click
- [x] the naming prompt, offered once
- [x] **playtested: chassis in 1.7s, salvage recovered, fragment installed, loyalty 0.15 → 0.45,
      59-60fps, zero errors**
- [x] **THE RECALL** (`IND-34c`) ... `[Q]`, instant, always available, no cooldown. With it: the
      bank (`world.banked`), the anchor drawn as the one warm place in a cold field, a cold
      contracting flash, and death now costs the carried pack. 7/7 probe claims measured:
      banks the pack · moves 357px within 2 frames · lands on the anchor · site resets ·
      the companion comes with you · 5/5 presses registered under the overheat lock ·
      death takes carried and leaves kept. 60fps, zero errors.
- [x] **Curiosity reachable** ... `interestSeen` went 0 → 1 in a normal opening run, and the log now
      reads as a story: *it stands up · it stopped, and looked at something · recovered:
      ATTENDANCE · it broke off · it is badly damaged.*
- [x] **RAM actually gates** (found while fixing the above, see below)
- [x] **Log dedup** ... a repeated line refreshes its timestamp instead of stacking.
- [x] **THE FIRST LOSS** (`IND-34k`) ... the handler, the corridor of aftermath, the warden that
      announces itself politely, the one-shot rule, the glowing heart, the socket filled by
      something that died. 9/9 verdicts measured end to end, and the heart moment re-run 3x for
      reliability (closest approach 21 / 23 / 21px) after the first version passed once by luck.
- [x] **The world edge** ... the ground faded instead of being cut. Past `DEEP_X` a hard black
      rectangle sat in frame for the whole back half of the game.
- [x] **PERMADEATH** (`IND-34c` §what death means) ... you die, character gone, gear gone including
      everything banked, fame recorded, start again. **And your companion does not die.** It stays
      where you fell, visible, waiting, every fragment intact. Going back for it is a real
      expedition because you are now weak, and it does not simply resume: loyalty 0.55 → 0.34,
      caution 0.15 → 0.39, the name survives, and the rest is earned back over about three minutes
      of ordinary company. 12/12 measured.
- [x] **THE CALIBRATION PASS** (`IND-34n`) ... depth-scaled tiers measured from the PLAYER, so
      walking east raises the stakes and walking home lowers them, with no wall and no warning.
      Per-hit margin now spans **12.8 hits at the anchor to 4.5 in the deep (2.8x)**, matching
      RotMG's shape. Casters added: they hold at 300px and fire slow, dodgeable, red-glowing
      shots, so the fight finally has a second verb. Crowd cap cut from a flat 7 to 3-in-the-
      shallows / 6-at-the-edge. 5/5 measured, and every earlier probe re-run green.
- [x] **INTERPOSE** (`IND-34a` §it saves you) ... capability + disposition + history, no die roll,
      and it destroys the fragment that let it. 8/8 measured, and the numbers say the design:
      **B saves you at willingness 1.882; C is the identical machine at 0.983 and lets you take
      the hit; D at 1.125 is flipped by PRESERVATION alone; D2 at 1.583 saves you again.**
      Care is now spendable (`hold [E]`) and danger-weighted, measured at 3.5x.
- [x] **The single damage door.** All three player-damage paths route through `hurtPlayer()`, so
      the interposition cannot be true on one and silently absent on another.

## found by playtesting, fixed

- **Nothing was findable.** The chassis sat 320px away in a 1600x1200 field with no marker, and a
  player who walked thirty seconds found neither it nor a single piece of salvage. ⚠ **Findability is
  not polish at P0, it is whether the game has an opening at all.** Fixed: chassis visible from spawn,
  a trail of salvage between, one interest point placed close.

- **The recall alone is a teleport.** Without something at stake, `[Q]` is just fast travel. The
  bank is the mechanic: carried is at risk, kept is safe, and one button moves things between
  them. ⚠ Shipping the button without the stake would have "completed" the item and delivered
  none of the design.

- **My own probe reported a false FAIL.** The death test set `hp = 0.0001` and asserted against
  `hp <= 0`, which is false, so the branch never ran and the probe blamed the game. ⚠ **A failing
  assertion is a claim about the probe as much as about the code.** Read the measurement before
  believing either.

- 🚨 **I spent four measurement rounds testing a bundle I had not rebuilt.** Changed an interpose
  threshold from 1.05 to 1.30, wrote the probe, ran it, and watched a willingness of 1.125 sail
  past a bar of 1.30 five times. ⚠ **Every measurement was correct. They were measurements of old
  code.** The probes serve `dist/`, so an unbuilt `src` change tests the previous build in total
  silence. **Fixed structurally**: every probe now refuses to run if `src` is newer than `dist`.
  A discipline that depends on me remembering is not a discipline.

- 🚨 **The spawn RNG was re-seeded on every single spawn**, so `r() < 0.22 + depth * 0.26` was not
  a probability at all. It built a fresh `seedrandom` from `String(this.t)` per call and read only
  the first value, and adjacent seeds do not give independent first draws. Measured: **0% casters
  below the threshold and 100% above it.** ⚠ Law 7 asks for *replayable*, not *re-seeded* ... one
  persistent stream drawn sequentially. Now 0% / 34% / 44% / 45% across the depth bands.

- **Three probes encoded the OLD contract and failed the new one.** The recall probe asserted that
  banked fragments survive death, which was true of the stub and is now deliberately false. The
  first-loss probe staged its controlled kill at the player's feet, so the player walked over the
  heart within two frames and pocketed it. ⚠ **When the design changes, the probes are part of the
  design.** A red probe is a claim about which of the two is stale, and it is not always the code.

- 🚨 **Calibrated against the real RotMG** (`IND-34n`, extracted from the local install: 33,762
  object records, 5,775 enemies, 12,863 projectiles). Three findings that change the build:
  1. **Time-to-die is a designed constant of ~5 hits across the WHOLE game.** Health 150 → 750 and
     enemy damage 30 → 150, in lockstep. ⚠ **Progression buys access, never safety.** If a better
     machine ever makes the field feel safe, this has stopped being the genre.
  2. **The opening is ~3x gentler than the average.** The literal first enemy is 70hp / 9 damage
     against 150hp: **16 hits to die.** 🚨 **SCRAPHEART is inverted** ... the warden is a 3.3-hit
     killer arriving in the first ten minutes, which is exactly why four probes died in the deep.
     **The fix is a gentler opening tier, not a nerfed warden.**
  3. **Enemies outrange the player 1.5-4x** (enemy median 13.5 tiles; best weapon 9.0). 🚨 **Every
     SCRAPHEART enemy is melee and the player outranges them ~8x**, so there is no dodging game:
     you kite for free until enough bodies converge and then die instantly and unteachably. ⚠ That
     satisfies "everything is dodgeable" on paper and violates it in spirit.

- 🚨 **The deep kills the player on every single automated run, and the first-loss beat pays for
  it twice.** Four probe versions died there. Die during IND-34k and you lose the dog AND your
  machine in the same minute ... the heart is on the ground, your companion is standing next to
  it, and a brand new character has to walk back through the thing that just killed them. ⚠ The
  design's own risk list says the beat "can read as cruelty and lose the player in hour one." This
  is the shape that would do it. **Only real playtesting settles whether it is dire or unfair**,
  and it is the first thing to watch for at the gate.

- **A bot dying proves the bot cannot dodge.** `IND-34c` requires that everything is dodgeable and
  that you die in three or four hits, so a crude probe standing in a warden's swing is measuring
  its own driving. ⚠ **Test the CLAIM, not the journey to it**: "a warden one-shots a handler" is
  now checked by putting a 999hp handler next to a warden and watching it die in one strike (12ms),
  and the organic path is covered by the surrounding verdicts. Three iterations were spent tuning
  a bot before I noticed I had written this exact rule into this exact file already.

- **A probe that props up the thing it measures must say so out loud.** Verdict 8 pins the player
  alive and restores the companion, because it is a claim about the companion's curiosity and not
  about player survival. That is legitimate and it is also one edit away from a probe that passes
  by construction, so it is commented at the call site and printed in the output.

- 🚨 **The companion PERCEIVED the world twice, and the copies drifted.** `score()` and `act()`
  each had their own `interesting` / `lootNear` / `near` lookups. I taught the scorer that the
  heart is visible from further away and did not teach the actor, so the companion chose
  `investigate`, walked toward a random point, and never arrived. Measured: **48 of 90 samples in
  `investigate`, closest approach 333px.** ⚠ **It looked exactly like the feature working until I
  read the distance.** There is now one `perceive()`. Deciding and acting must see the same world.

- **The heart moment passed once and I nearly shipped it.** The first fix measured 21px (pass);
  the next identical run measured 161px (fail) with no code change between them. ⚠ **A single
  green run is not evidence when the failure mode is variance.** Everything that depends on
  emergent behaviour gets run 3x before it counts.

- **My exit path existed twice too.** `recall()` learned to preserve the warden and the death path
  did not, so dying once deleted the warden forever while `wardenSpawned` stayed true and blocked
  the respawn. One `resetSite()` now. ⚠ Same class as the perception bug, same day, twice.

- **The first probe measured its own patience.** It parked the player next to a warden that hits
  for 30 and reported that the handler-death rule was broken. The player had died first. ⚠ A probe
  that does not behave like a player measures the probe.

- **A TypeError inside `page.evaluate` reads as "execution context was destroyed."** `world.logs`
  holds `{text, t}` objects and I called `.includes` on them. Three runs were spent hunting a
  renderer crash that was my own probe throwing.

- **RAM was decorative, and RAM is the signature mechanic of the whole game.** Measured: the
  chosen behaviour matched the top scorer in **241 of 241 samples**. The warm set was recomputed
  every tick as the top-`ram` slice of the *same ranking it was meant to constrain*, so `ranked[0]`
  was warm by construction and could never be gated. ⚠ **A limit derived from the thing it limits
  is not a limit.** Fixed by making the warm set persist with a reload window. Now measured by
  shock test: RAM 2 evicts `investigate` to load `flee` (150ms), RAM 7 drops nothing and reacts
  in 0ms. The felt consequence is the right one ... **a small mind stops noticing beautiful
  things when it gets frightened.**

- **Curiosity was arithmetically impossible, not merely rare.** `investigate` peaked at 0.175
  against a `follow` FLOOR of 0.285. No amount of play would ever have surfaced it. Fixed with a
  proximity term (a curious machine is drawn to what is *right there*, not to everything in its
  radius) and by dropping follow's floor, since a machine at your shoulder does not need to want
  to follow you.

- **The log said "it broke off." six times in a row.** Transitions oscillate by design (the scorer
  has jitter) and every entry logged. ⚠ A repeated line trains the player to stop reading the log,
  which costs every message that matters ... including the ones the P0 gate depends on.

- **Overheat is nearly unreachable, so the heat mechanic is currently decorative.** Measured: heat
  climbs ~0.27/s net (the decay branch runs on every frame between shots), so the lock needs
  ~3.7s of *continuous* fire. Two probe runs at 2.6s never once tripped it. Nobody holds fire that
  long in play. Either the climb rate goes up or heat is a bar that never means anything.

## next, in order

1. **Heat must be reachable** (see the finding above) or cut the bar.
2. **Dust weather** (`IND-34i`) ... attacks GPU. Visible from a distance, avoidable, better salvage
   inside.
3. **The stopped ones** (`IND-34l`) ... machines that gave up in place. Still ON. The tell is a light.
4. **The handler needs its 20-30 minutes.** It currently arrives at t=40s and can die within the
   minute. ⚠ IND-34k is explicit that if it is only there to die, players feel handled. The gap
   is a tuning question that only real playtesting answers.
7. **Real-device pass** (`game-perf`) ... mid-range Android, 400 entities, thermal test at minute 10.
8. **The gate itself.** Ten people, one hour, watched.

## refused, permanently

No affinity meter. No commandable companion. No dailies, no energy, no purchasable power. No
explanation of the Scatter. No music except two cues. No collectible counter for things worth
nothing.
