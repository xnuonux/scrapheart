extends RefCounted
class_name Tuning

## 🚨 EVERY MEASURED NUMBER IN SCRAPHEART, IN ONE FILE.
##
## These are not guesses and they are not preferences. Each one was established by
## running the web build and reading an instrument, and each cost something to find.
## The renderer is being rewritten; **these are not.**
##
## ⚠ IF YOU CHANGE A NUMBER HERE, YOU ARE OVERRULING A MEASUREMENT. Do it deliberately,
## re-run the parity test, and write down what you saw that the instrument did not.
##
## Source of truth for the port: ../../src (the web build) and ../../NEXT.md.

# ── THE WORLD ───────────────────────────────────────────────────────────────────
const W: float = 1600.0
const H: float = 1200.0
## "deeper is east." no wall, no gate, no warning ... the corridor of aftermath is the
## only marker and a player is free to read it as scenery.
const DEEP_X: float = 1080.0

# ── LETHALITY (IND-34n, calibrated against a real RotMG install) ─────────────────
#
# 🚨 RotMG holds time-to-die at ~5 hits across an ENTIRE character life: health 150→750
# and enemy damage 30→150, in lockstep. Progression buys ACCESS, never safety. Its first
# hour gives ~3x that margin (70hp/9dmg vs 150hp = 16 hits).
#
# SCRAPHEART was inverted: a flat 12-damage runner from the first second and a 30-damage
# warden ten minutes in. Four consecutive automated runs died in the deep and never once
# died in the shallows. Depth is measured from the PLAYER, so walking east raises the
# stakes and walking home lowers them.
const PLAYER_HP: float = 100.0
const DEPTH_START: float = 340.0          ## depth 0 begins here
const RUNNER_DMG_NEAR: float = 7.0        ## ~14 hits at the anchor
const RUNNER_DMG_DEEP: float = 22.0       ## ~4.5 hits at the edge
const CASTER_DMG_NEAR: float = 6.0
const CASTER_DMG_DEEP: float = 16.0
const WARDEN_DMG: float = 30.0            ## ⚠ the exception. never nerf it; gentle the OPENING
const CROWD_NEAR: int = 3
const CROWD_DEEP: int = 6                 ## a crowd is not a pattern

static func depth_at(x: float) -> float:
	return clampf((x - DEPTH_START) / (W - 480.0), 0.0, 1.0)

static func runner_damage(d: float) -> float:
	return lerpf(RUNNER_DMG_NEAR, RUNNER_DMG_DEEP, d)

static func caster_damage(d: float) -> float:
	return lerpf(CASTER_DMG_NEAR, CASTER_DMG_DEEP, d)

# ── HEAT (IND-34j: "a rhythm mechanic, not a resource chore") ────────────────────
#
# ⚠ The bug worth remembering: the cooling branch sat in the `else` of a FIRE-RATE check,
# so it ran between shots while the trigger was held. Net climb 0.27/s, lock needed 3.7s
# of unbroken fire, and it never once tripped. Holding the trigger must NOT cool.
const HEAT_PER_SHOT: float = 0.075
const FIRE_CD: float = 0.14
const HEAT_COOL: float = 0.70             ## roughly matches the climb, so restraint is a rhythm
const HEAT_COOL_LOCKED: float = 0.85
const OVERHEAT_LOCK: float = 2.0
# measured: lock at 1.97s held, lock lasts 2.02s, 10 bursts of 0.9s-on/0.7s-off never lock

# ── THE COMPANION'S MIND ────────────────────────────────────────────────────────
const DISPOSITION_BASE: float = 0.15
const DISPOSITION_MAX: float = 1.2
## RAM reload. ⚠ the warm set PERSISTS; recomputing it from the same ranking it
## constrains made RAM decorative (241/241 samples matched the top scorer).
const SWAP_WINDOW: float = 1.0
## 🚨 bravery is `loyalty - caution`, with NO coefficient, because the doc's sentence has
## none. A `caution * 1.6` version ate 0.24 flat and stopped a machine carrying
## ATTENDANCE ... three times more loyal than cautious ... from ever advancing.
const COVER_GAIN: float = 2.40
const COVER_RANGE: float = 400.0
const RETREAT_RANGE: float = 330.0        ## you are only retreating FROM something close
const RETREAT_DOT: float = 0.35
## curiosity was arithmetically impossible before this: investigate peaked at 0.175
## against a follow FLOOR of 0.285 and was never chosen in 241 samples.
const FOLLOW_FLOOR: float = 0.10
const FOLLOW_GAIN: float = 1.00
const FOLLOW_SLACK: float = 90.0
const INVESTIGATE_GAIN: float = 2.10
const AFRAID_RANGE: float = 240.0
const AFRAID_DAMP: float = 0.12
## IND-34k's heart is the only thing above 1. pull extends REACH as well as weight,
## because without it the beat was a coin flip: 21px one run, 161px the next.
const HEART_PULL: float = 5.0

# ── INTERPOSITION (IND-34a: capability + disposition + history) ──────────────────
#
# no randomness anywhere. the same machine in the same state makes the same choice,
# which is the only way a player can learn what they BUILT rather than what they rolled.
const INTERPOSE_REACH: float = 96.0
const INTERPOSE_DANGER: float = 0.34      ## only for a hit that actually threatens you
const INTERPOSE_HISTORY_FULL: float = 6.0 ## careShown at which history maxes
const INTERPOSE_BAR: float = 1.30
# measured: heart+cared 1.882 saves · same machine careShown 0 → 0.983 lets you die
#           +PRESERVATION 1.125 → refuses · same history without it 1.583 → saves

# ── CARE (the history interposition reads) ──────────────────────────────────────
const MEND_RATE: float = 16.0
const MEND_REACH: float = 42.0
const CARE_RATE: float = 0.30
const CARE_DANGER_MULT: float = 2.6       ## measured 2.6-3.8x for mending under fire

# ── THE SOCKET ECONOMY (IND-34a / IND-34i) ──────────────────────────────────────
#
# ⚠ removal did not exist at all until 2026-08-06, so `degrade_on_removal` was written,
# correct, and never called, and a companion with full sockets was frozen for the run.
const DEGRADE_PER_PULL: float = 0.28      ## 0.28 → 0.56 → 0.84 → gone: four cycles
const WORN_RESIST: float = 0.80           ## a lived-in fragment survives 12 cycles, not 4

static func degrade(degradation: float, worn: float) -> float:
	return minf(1.0, degradation + DEGRADE_PER_PULL * (1.0 - worn * WORN_RESIST))

# ── PERMADEATH (IND-34c) ────────────────────────────────────────────────────────
## ⚠ BANKED IS NOT SAFE FROM DYING. banking protects you from a room, never from death,
## or there is no permadeath ... only an inconvenient checkpoint.
const BOND_ON_RETRIEVE: float = 0.40
const BOND_RECOVER: float = 0.0034        ## ~3 min of ordinary company back to whole
const BOND_LOYALTY_FLOOR: float = 0.35    ## loyalty *= floor + (1-floor)*bond
const BOND_CAUTION_GAIN: float = 0.40

# ── THE FIRST LOSS (IND-34k) ────────────────────────────────────────────────────
## 🚨 THE ONLY NUMBER HERE A MEASUREMENT DOES NOT OWN. 34k asks for 20-30 minutes of the
## handler being good company; the gate is a ONE HOUR session and the beat must land
## inside it. ⚠ Watch a real person: if the dog still feels like a device when the warden
## arrives, this is too small, and it is the only thing that needs changing.
const HANDLER_GRACE: float = 480.0
const HANDLER_ARRIVES: float = 40.0
const WARDEN_ONESHOT_RADIUS: float = 78.0 ## always. everywhere. forever.

# ── PERCEPTION + WEATHER ────────────────────────────────────────────────────────
const DUST_GPU_LOSS: float = 0.62         ## 170px → 65px inside a storm
const DUST_DROP_BONUS: float = 0.34       ## 0.22 → 0.56: the reason to go in anyway
const DUST_BLIND_RANGE: float = 210.0     ## weather is COVER as often as it is a threat
## ⚠ MARKING's band is the mechanic. reach 1.9x against an "obvious" gate of 300 gave a
## 23-PIXEL shell and measured dead. below OBVIOUS a posture tells you nothing; past
## reach the machine does not know either.
const MARK_OBVIOUS: float = 420.0
const MARK_REACH_MULT: float = 4.5

# ── THE SIGNAL THE WHOLE GATE RESTS ON ──────────────────────────────────────────
## 🚨 "seven name the companion unprompted AND REACT WHEN IT IS BADLY HURT."
## ⚠ This fired below 0.4 while ordinary play bottoms out at 0.43, so the most important
## signal in the build was tuned just under where the game actually goes and never fired.
## The log line, the halo and the dimming all use THIS number. Three thresholds for one
## idea is how a game says "it is hurt" about a machine that still looks fine.
const HURT_THRESHOLD: float = 0.50
const HURT_RESET: float = 0.85

# ── THE BESTIARY (IND-34b / 34i / 34j / 34l) ────────────────────────────────────
## loops: stuck repeating a fragment of an action. erratic, fast, short-lived, and
## there should not be many. it burns out on its own ... nothing needed killing it.
const LOOP_LIFE: float = 10.0
const LOOP_SPEED: float = 2.1
const LOOP_TURN: float = 0.7              ## a new random heading every this many seconds
const LOOP_DMG: float = 6.0
## scavengers: other assemblers. they take a fragment ... not damage it, TAKE it ...
## and it runs in them, visibly. 🚨 the floor (34b/34q): a settled companion is never
## at risk. they can only steal a socket filled recently.
const SCAV_STALK: float = 300.0           ## it watches from here
const SCAV_STEAL_REACH: float = 34.0
const SCAV_WINDOW: float = 90.0           ## a socket filled within this can be taken
const SCAV_FLEE_SPEED: float = 2.35
const SCAV_SPEED: float = 1.15
## beasts: built in animal shapes, still doing animal-shaped things for no reason.
const HERDER_PULSE_EVERY: float = 6.0
const HERDER_PUSH: float = 620.0          ## px/s of displacement for ~0.15s ... not damage
const HERDER_RANGE: float = 150.0
const PEST_DMG: float = 5.0
const PEST_SPEED: float = 1.9
const DRAY_SPEED: float = 0.55
const DRAY_DMG: float = 24.0
const DRAY_KNOCK: float = 150.0
## degrees (34l): the rule stays absolute; what varies is whether the machine can
## still execute it. intact is the default. degrees are FOUND, not encountered.
const WARDEN_PERIMETER_R: float = 130.0

# ── THE STORYLINE (IND-34q / 34f / 34b / 34r) ───────────────────────────────────
## the machine beside you at wake. it says one thing. the game never says why.
const DORMANT_EVERY: float = 11.0
## the repair unit: free, full, forever, and it will not stop offering (34f)
const REPAIR_RATE: float = 20.0
const REPAIR_RANGE: float = 90.0
## the foreman's standing work, and its manifest (34f: the final instruction)
const WORK_ORDER_NEED: int = 5
const FOREMAN_MANIFEST: int = 3
## the door (34r). it is passable the way things become passable: when you have
## the parts. it never asks. it is not a menu option. it is a door.
const DOOR_FRAGS: int = 3
## the handler by degree (34l): degree 2 "will not leave" ... it is waiting for
## someone. rare, unmarked, placed where nobody has a reason to be. you can strip
## it for parts; it will not resist; it will still be facing the door.
const WAITING_HANDLER_POS := Vector2(1500.0, 180.0)
## what is buried (34i §2): found by your companion, and only if it is built to
## care. a curious machine stops, and looks, and you learn to read that. a
## companion with no curiosity walks past everything buried in the game, forever.
const BURIED_N: int = 7
const BURIED_DIG: float = 2.6             ## seconds of standing still while it digs
const BURIED_CURIOSITY: float = 0.30      ## the disposition the dig asks for
