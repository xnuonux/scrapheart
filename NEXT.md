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

1. **Death must end something.** Still the stub `you would have died here` ... it costs the carried
   pack now, but the run does not end. ⚠ The permadeath the entire risk economy is written
   against does not exist yet, so the recall currently buys you something that was never in
   danger.
2. **Interpose** (`IND-34a`) ... capability + disposition + history, and it destroys the fragment
   that let it. The heart grants it and carries the loyalty, so the bookend is half-built already:
   the first socket the player fills holds something that died, and the last one is emptied by
   something saving them. Needs `careShown` wired to repairs.
3. **Heat must be reachable** (see the finding above) or cut the bar.
4. **Dust weather** (`IND-34i`) ... attacks GPU. Visible from a distance, avoidable, better salvage
   inside.
5. **The stopped ones** (`IND-34l`) ... machines that gave up in place. Still ON. The tell is a light.
6. **The handler needs its 20-30 minutes.** It currently arrives at t=40s and can die within the
   minute. ⚠ IND-34k is explicit that if it is only there to die, players feel handled. The gap
   is a tuning question that only real playtesting answers.
7. **Real-device pass** (`game-perf`) ... mid-range Android, 400 entities, thermal test at minute 10.
8. **The gate itself.** Ten people, one hour, watched.

## refused, permanently

No affinity meter. No commandable companion. No dailies, no energy, no purchasable power. No
explanation of the Scatter. No music except two cues. No collectible counter for things worth
nothing.
