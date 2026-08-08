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
- [x] ~~the naming prompt, offered once~~ ... **REMOVED, see below**
- [x] 🚨 **THE NAMING BUTTON MADE THE GATE UNMEASURABLE.** The gate is "seven name the companion
      **unprompted**", and the build shipped a `<button>give it a name</button>` that appeared the
      moment the machine stood up. ⚠ **A player who clicks a control labelled "give it a name" has
      followed an instruction. A player who names a thing nobody asked them to name has formed an
      attachment.** Those are different events, only one is the thing being tested, and the button
      would have produced a number that looked like a pass. Naming now lives unlabelled in the
      pack panel where you already assemble the thing: reads `unnamed`, no call to action, absent
      from the key hints. **Discoverable, never offered.** 5/5 measured, and the game now has zero
      buttons anywhere.
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
- [x] **HEAT IS REAL** (`IND-34j`) ... the cooling branch was running on every frame *between*
      shots while the trigger was still held, so the net climb was 0.27/s and the lock needed
      ~3.7s of unbroken fire that nobody would ever produce. Holding the trigger no longer cools
      the driver, and cooling was raised to roughly match heating so restraint is a rhythm rather
      than a ratio to compute. Measured: **lock at 1.97s, lock lasts 2.02s, and ten bursts of
      0.9s-on / 0.7s-off never lock at all.** 4/4.
- [x] **DUST WEATHER** (`IND-34i`) ... spawns off-map so you watch it arrive, drifts across, ramps
      in rather than snapping on, and attacks **GPU** so the same storm is trivial for one build
      and crippling for another. 6/6 measured: perception **170px → 65px**, drop chance
      **0.22 → 0.56** inside, and it is **cover as much as threat** ... a runner closed 127px on
      the player in clear air and **22px** in dust. The player's own vignette tightens with it.
- [x] **THE ONES THAT GAVE UP** (`IND-34l`) ... machines that stopped where they were, still ON,
      found individually and never in groups (6 of them, closest pair 312px apart). They do not
      react to anything: standing on one for 3.5s moved it 0px and cost 0 damage. **Every one is
      salvage and the intact ones are BETTER** ... 2 guaranteed fragments against a runner's 0.23
      expected, so the most upsetting thing in a room is usually the most profitable, and the game
      never comments.
- [x] **A WARDEN BY DEGREE** (`IND-34l`) ... one that announced and cannot follow through. Standing
      inside its reach for 5 seconds costs nothing. It re-arms and gives the warning again every
      time you pass, forever. ⚠ Unmarked, unlabelled, placed where nobody has a reason to be, and
      the rule stays absolute: a warden **that can act** still one-shots a handler. 7/7, and the
      pair is proven both ways ... an intact warden kills a 999hp handler in **one strike, 9ms**,
      and the broken one cannot kill it in **four seconds with the handler sitting in its lap**.
- [x] **PERF + THE FIRST REAL TOUCH PASS.** Dust now blits one cached sprite instead of building
      six radial gradients every frame: desktop back to a flat **60fps in dust** (was 55-57).
      Emulated Pixel 5 at 2.75x DPR with **4x CPU throttling**, in the worst case the game has
      (deep + dust + full crowd + casters): **26-32fps against `core/loop`'s deliberate 30fps
      touch cap**, worst frame 82ms, no spikes over 100ms.
- [x] 🚨 **A REAL INPUT BUG, found by finally exercising touch.** `canvas.setPointerCapture()` is
      the FIRST line of the `pointerdown` handler and it **throws** when the pointer id is already
      gone. The throw took fire, aim and the stick with it, and a dropped input is invisible ...
      the player taps, nothing happens, nothing logs. ⚠ **Capture is an optimisation; input is
      not. Never let the optimisation be able to cancel the thing it optimises.** Now wrapped.
      Verified after: stick moves 188px, releases to 0px drift, firing raises heat to 0.82, and
      `pointercancel` leaves nothing stuck on.
- [x] 🚨 **THE GATE'S OWN PRECONDITIONS, finally measured.** Every system here was verified except
      the two things the gate actually tests. Three minutes of ordinary play found **both broken**:
      1. **The warden spawned at t=40.4s and the handler arrived at t=40.4s.** Zero seconds of
         company. The position gate was satisfied the moment the dog existed, so a player who
         drifts east early loses it instantly ... `IND-34k`'s "if it is only there to die, players
         feel handled" in its most extreme possible form. Going deep is no longer sufficient; the
         dog has to have BEEN there (`HANDLER_GRACE`, 8 min, the one number a playtest owns).
      2. **The companion fell to 43% of its health and the game said nothing.** The only line
         lived behind `hp <= 0`, so the single most important signal in the build fired
         exclusively at the floor. ⚠ **A player cannot react to something they never notice.**
         It now speaks once on crossing into real trouble and stays quiet until made whole, and
         `drawCompanion`'s `hurt` parameter ... **hardcoded to 0, so the damage state the gate
         depends on was never once drawn** ... is wired: it dims and its light stutters.
      5/5 after, and the handler now survives a full run.
- [x] 🚨 **THE FURNITURE BUG.** `IND-34l`'s stopped ones share the `Threat` type because they are
      shootable salvage, so **every `threats` filter written before they existed silently counted
      them**: the companion scored `flee` against a machine that gave up, the handler charged over
      to shoot furniture, and repairing beside one counted as "under fire". ⚠ **Worst of all,
      standing near one damped `investigate` to 12%, so the objects that ARE the atmosphere were
      switching the atmosphere system off.** One `isHostile()` predicate now. 5/5: the companion
      reached 20px of a beautiful thing while parked beside a stopped machine, never fled it,
      never shot it, and the handler stayed at 0px from the player.
- [x] **THE SOAK** ... the gate is an hour and nothing had ever run past three minutes. An hour of
      kills with nothing collected: **1234 salvage entries at a flat 60fps**, worst frame 50.9ms.
      Six real minutes of continuous play: **60fps, heap flat at 10MB (0.00 MB/min)**, salvage
      growing 6.4/min (~382 over a full session). Nothing unbounded.
- [x] 🚨 **COVERING HAD NEVER FIRED ONCE.** `p.retreating` was assigned `false` every frame and set
      `true` **nowhere in the codebase**, and `s.cover` is gated entirely on it. So *"when you
      retreat, a brave companion advances"* ... which `IND-34c` calls **the entire emotional engine
      of this game** ... scored zero on every frame since the first commit. The retreat ring in
      `drawPlayer` never drew either. ⚠ **A field that is declared, read, and never written reads
      as a working feature in every code review.**
      Retreat is now inferred from movement away from something close (never a button, exactly as
      `34c` asks). And once it worked, cover *still* lost, because the shape was wrong: **cover
      decayed with distance while follow grew with it**, so a player falling back always outran
      their own companion's bravery. Wider radius, stronger pull. Measured 5/5 with a control:
      **loyalty 0.7 covers 15/30 samples and advances 47px toward the threat while you fall back;
      loyalty 0.15 never covers at all.** *You did not order it to cover you. You built something
      that would.*
- [x] 🚨 **THE SOCKET ECONOMY EXISTED ONLY ON PAPER.** `install` filled empty slots and **nothing
      anywhere removed a fragment**, so a companion with three full sockets was frozen for the
      rest of the run ... a player who installed three poor fragments early had no way back, which
      is not a difficulty curve but a dead end they cannot see coming. And `degradeOnRemoval` was
      written, correct, and **never once called**, taking IND-34a's whole "cycled three or four
      times and it is worn to nothing" economy with it. 5/5 measured, and the numbers land on the
      doc: pulling costs **28%**, cycling runs **0.28 → 0.56 → 0.84 → destroyed**, a lived-in
      fragment survives **12 cycles against a wild one's 4**, and pulling the loyal piece drops
      loyalty **0.70 → 0.15**.
- [x] **The single damage door.** All three player-damage paths route through `hurtPlayer()`, so
      the interposition cannot be true on one and silently absent on another.
- [x] 🚨 **THE IMMORTAL MACHINE CLASS** (found by dom, first session on the beast PC, 2026-08-08).
      Threat damage was subtracted in three places while each kind's DEATH CHECK lived inside its
      own behaviour branch, so any `continue` above the check made a machine immortal. The
      degree-2 warden exited at its own early-out before its check could ever run: the handler
      parked in its lap grinding its hp **thousands below zero** while the health bar drew
      **backwards across the field** (dom's screenshot shows a red line ~300px long). Dust-blinded
      runners `continue`d past theirs too and wore negative bars until the storm passed. ⚠ **The
      fix is `hurtThreat()`, the twin of `hurtPlayer()`** ... every source (player bullets, the
      handler's gun, companion melee) routes through one door and death happens there, whatever
      branch the behaviour was in. The scattered checks are deleted, the renderer clamps the bar
      so it can never lie, and the broken warden is killable (340hp of grinding, drops selfpres):
      "forever" describes its behaviour, not its armour. `_probe_immortal` 5/5, and the
      neighbours re-ran green: loss 9/9+both-ways, death 12/12, calib 5/5, gate's hurt-leg 3/3
      (its flee leg is emergent and sits at 2/3, as it did before the change).

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

- 🚨 **Adding a second of anything breaks every `find()` that assumed one.** The degree-2 warden
  made `find(t => t.kind === 'warden')` ambiguous in three places at once: `resetSite` kept
  whichever it happened to pick and silently deleted the other, and the first-loss probe grabbed
  the broken one and reported the **absolute rule** as violated. ⚠ **`find` on a kind is a
  singleton assumption written in a way that never announces itself.** The complement is now
  asserted too, so "degree" cannot quietly become a cosmetic label.

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

- **Overheat was nearly unreachable.** FIXED, see done. The cause is worth keeping: a cooling
  branch sitting in the `else` of a *fire-rate* check, so it ran between shots while the trigger
  was held. ⚠ **The bug was in the control flow, not the constants**, and three rounds of tuning
  numbers would never have found it.

- **A probe that breaks on the wrong event measures nothing.** The lock-duration check exited on
  `heat <= 0` at 1.2s, but the LOCK is a fixed 2s window, so it returned -1ms three times running.
  Two independent events need two independent records.

## how to play it

**`SCRAPHEART.html`** in this folder. **Double-click it.** No npm, no server, no terminal,
49 kB, one file. Verified booting from `file://` with zero console noise.

Rebuild it with `npm run pack` after any change.

`WASD` move · `click/hold` fire · `Q` leave · `E` hold near a damaged companion to repair it ·
`I` pack · `M` mute. On a phone: left thumb is a floating stick, right side fires.

⚠ **The `[Q]` and `[E]` keys carry two of the three systems the gate is testing.** If a watcher
has to be told about them, that is itself a finding.

🚨 **Do not tell a tester they can name it.** The name field is in the pack panel and it is
deliberately unlabelled. **The moment you mention it, that player's data is spent** ... they can
still be watched for everything else, but they no longer count toward the seven.

## found by playtesting, open (dom's first session, 2026-08-08 ... design calls, his to rule)

⚠ Dom knows the name field exists, so his data is spent for the gate's seven. Everything else
he reported is real first-contact data from a player who was given no instructions, and it
landed almost exactly where this file predicted it would:

- **The install loop went entirely undiscovered.** He collected ~20 fragments, watched the
  pickup lines appear and vanish top-right, and never learned they were FOR anything ... never
  opened the pack. His words: "idk what to do with them." 🚨 The assembly of the companion is
  the emotional core of the game, and a stranger did not find it in a full session. The pack
  hint exists on the bottom line; it is not landing. (Predicted: "if a watcher has to be told
  about [Q]/[E], that is itself a finding." It is now a measured one, and it extends to [I].)
- **Salvage density read as noise**: "too many gold dots, too much probably." The findability
  fix that made the opening legible may have overshot into clutter.
- **The warden's announcement read as a kill-confirmation toast.** He killed a crowd, then the
  re-arm line fired ("AREA IS BEING CLEARED") and he read it as "area cleared: you win",
  repeatedly. The politeness landed as UI, not as a machine speaking.
- **Controls half-discovered**: WASD + fire + Q learned in play, E never learned, I never found.
- **He found the degree-2 warden unprompted** (deep corner, no reason to be there) and read the
  fight as "a boss that never dies" ... which, at the time, it literally was (see the immortal
  machine entry above). Worth re-asking once the bug is out whether the broken warden READS.

## next, in order

🚨 **Everything buildable from the spec is built. All three remaining items need a human, a
phone, or ten strangers, and none of them can be closed by writing more code.** That is the
honest state, and continuing to add systems now would be avoiding the gate rather than
approaching it.

1. **`can.mark` is granted and read by nothing.** SURVEY OPTIC hands out a capability that does
   not exist. `IND-34c` describes MARKING as "it flags what it perceives before you do ... a high
   perception companion is an early warning system, and a low one is a liability you love", while
   also forbidding a UI marker or a line of dialogue. ⚠ **That leaves position and posture as the
   only channel**, which is close enough to `investigate` that it needs a design call, not an
   implementation. Until then SURVEY OPTIC is selling something it does not deliver.
2. **`HANDLER_GRACE` is a guess and it is the only one left.** Set to 8 minutes, because
   `IND-34k` asks for 20-30 but the gate is a one-hour session and the beat has to land inside
   it. ⚠ **Watch a real person: if the dog still feels like a device rather than a companion when
   the warden arrives, this number is too small**, and it is the only thing that needs changing.
2. **Real-device pass** (`game-perf`) ... an emulated Pixel 5 under 4x CPU throttle now holds
   26-32fps against the intended 30 cap, with touch verified end to end. ⚠ **What emulation
   cannot tell you is thermal**: whether minute 10 in someone's hand is still 30fps, and whether
   the phone gets hot enough that they put it down. **That needs a real device and ten minutes.**
3. **THE GATE.** Ten people, one hour, watched. **Seven name the companion unprompted and react
   when it is badly hurt.** ⚠ If it fails, stop the project.

### what a watcher should look for, in priority order

- **Do they name it?** Unprompted, without the button. That is the whole gate.
- **Do they go back for it after they die?** The permadeath contract lives or dies here.
- **Does the first loss land, or does it read as cruelty?** ⚠ Dying during that beat costs the
  dog AND the machine in the same minute. **Highest-risk moment in the build.**
- **Does anyone repair it under fire?** If nobody does, interposition never fires and a whole
  system is invisible.
- **Does anyone stop at something worth nothing?** The atmosphere either works or it is decoration.

## refused, permanently

No affinity meter. No commandable companion. No dailies, no energy, no purchasable power. No
explanation of the Scatter. No music except two cues. No collectible counter for things worth
nothing.
