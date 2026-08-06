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

## found by playtesting, fixed

- **Nothing was findable.** The chassis sat 320px away in a 1600x1200 field with no marker, and a
  player who walked thirty seconds found neither it nor a single piece of salvage. ⚠ **Findability is
  not polish at P0, it is whether the game has an opening at all.** Fixed: chassis visible from spawn,
  a trail of salvage between, one interest point placed close.

## next, in order

1. **THE RECALL** (`IND-34c`) ... instant, always available, no cooldown. 🚨 The mechanic the whole
   risk economy rests on, and it is not in yet.
2. **Curiosity must be reachable early.** ⚠ Playtest showed `interestSeen: 0` ... with RAM 2 and base
   curiosity 0.15, the companion never investigates, so the entire atmosphere system is invisible.
   Either the starter has a little curiosity, or the first buried find is scripted (`IND-34i` §risks).
3. **THE FIRST LOSS** (`IND-34k`) ... the handler, the warden, the corridor of aftermath, the glowing
   heart, the empty socket filled by something that died. **The emotional spine of the P0.**
4. **Dust weather** (`IND-34i`) ... attacks GPU. Visible from a distance, avoidable, better salvage
   inside.
5. **The stopped ones** (`IND-34l`) ... machines that gave up in place. Still ON. The tell is a light.
6. **Interpose** (`IND-34a`) ... capability + disposition + history, and it destroys the fragment that
   let it. Needs `careShown` wired to repairs.
7. **Real-device pass** (`game-perf`) ... mid-range Android, 400 entities, thermal test at minute 10.
8. **The gate itself.** Ten people, one hour, watched.

## refused, permanently

No affinity meter. No commandable companion. No dailies, no energy, no purchasable power. No
explanation of the Scatter. No music except two cues. No collectible counter for things worth
nothing.
