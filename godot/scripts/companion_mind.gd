extends RefCounted
class_name CompanionMind

## THE MIND. Ported from src/game/companion.ts, which is the reference implementation.
##
## You never command it. It scores every behaviour it can hold WARM (limited by RAM) and
## acts on the highest. Everything it is comes from installed fragments.
##
## ⚠ Four bugs lived in this file's ancestor and not one of them threw, logged, or failed
## a typecheck. They are written into the comments below at the exact lines that fixed
## them, because that is the only place a future reader will be looking.

enum B { ENGAGE, COVER, REPAIR, SALVAGE, FOLLOW, INVESTIGATE, FLEE }
const BEHAVIOURS := [B.ENGAGE, B.COVER, B.REPAIR, B.SALVAGE, B.FOLLOW, B.INVESTIGATE, B.FLEE]
const NAMES := {
	B.ENGAGE: "engage", B.COVER: "cover", B.REPAIR: "repair", B.SALVAGE: "salvage",
	B.FOLLOW: "follow", B.INVESTIGATE: "investigate", B.FLEE: "flee",
}

# ── the body: computer parts as organs (IND-34c) ────────────────────────────────
var ram: int = 2            ## how many behaviours run at once
var cpu: float = 0.7        ## decision rate
var gpu: float = 170.0      ## perception
var battery: float = 1.0    ## capacity: drain divides by it, recovery multiplies
var sockets: int = 2        ## slots taking any fragment
var aux_sockets: int = 1    ## shaped slots; 'aux' fragments fit ONLY here

# ── state ───────────────────────────────────────────────────────────────────────
var installed: Array = [null, null, null]
var behaviour: int = B.FOLLOW
var scores := {}
var warm := {}              ## a SET of behaviours currently held in mind
var swap_cd: float = 0.0
var think: float = 0.0
var charge: float = 1.0
var care_shown: float = 0.0
var bond: float = 1.0
var facing: float = 0.0
var marked = null
var hurt_announced: bool = false

# derived
var loyalty: float = 0.15
var caution: float = 0.15
var aggression: float = 0.15
var curiosity: float = 0.15
var can := { "repair": false, "salvage": false, "mark": false, "interpose": false }


func socket_count() -> int:
	return sockets + aux_sockets


func is_aux_slot(slot: int) -> bool:
	return slot >= sockets


func live_fragments() -> Array:
	return installed.filter(func(f): return f != null)


func empty_sockets() -> int:
	return installed.filter(func(f): return f == null).size()


func recompute() -> void:
	loyalty = Tuning.DISPOSITION_BASE
	caution = Tuning.DISPOSITION_BASE
	aggression = Tuning.DISPOSITION_BASE
	curiosity = Tuning.DISPOSITION_BASE
	can = { "repair": false, "salvage": false, "mark": false, "interpose": false }
	for f in installed:
		if f == null:
			continue
		var eff: float = 1.0 - f.degradation
		loyalty += f.loyalty * eff
		caution += f.caution * eff
		aggression += f.aggression * eff
		curiosity += f.curiosity * eff
		for g in f.grants:
			can[g] = true

	# IND-34c: a companion that outlived its person keeps everything it is MADE of and
	# very little of what it FELT. ⚠ the fragments are untouched; only the READING of
	# loyalty is damped, because loyalty is the part that was about you specifically.
	loyalty *= Tuning.BOND_LOYALTY_FLOOR + (1.0 - Tuning.BOND_LOYALTY_FLOOR) * bond
	caution += (1.0 - bond) * Tuning.BOND_CAUTION_GAIN

	loyalty = clampf(loyalty, 0.0, Tuning.DISPOSITION_MAX)
	caution = clampf(caution, 0.0, Tuning.DISPOSITION_MAX)
	aggression = clampf(aggression, 0.0, Tuning.DISPOSITION_MAX)
	curiosity = clampf(curiosity, 0.0, Tuning.DISPOSITION_MAX)


func install(f, slot: int) -> bool:
	if slot < 0 or slot >= installed.size():
		return false
	if installed[slot] != null:
		return false
	# ⚠ SHAPE. `Fragment.shape` was set on every fragment in the catalogue and checked by
	# nothing, so shaped sockets did not exist and an aux fragment fitted anywhere.
	if f.shape == "aux" and not is_aux_slot(slot):
		return false
	installed[slot] = f
	recompute()
	return true


## 🚨 TAKING A PIECE BACK OUT. This did not exist at all in the first build, so a
## companion with full sockets was frozen for the rest of the run, and the entire
## degradation economy was a function nobody could reach.
## Returns { fragment, destroyed }. A fragment worn past 1 is GONE.
func remove(slot: int) -> Dictionary:
	if slot < 0 or slot >= installed.size() or installed[slot] == null:
		return { "fragment": null, "destroyed": false }
	var f = installed[slot]
	installed[slot] = null
	f.degradation = Tuning.degrade(f.degradation, f.worn)
	recompute()
	if f.degradation >= 1.0:
		return { "fragment": null, "destroyed": true }
	return { "fragment": f, "destroyed": false }


## ⚠ ONE perception, shared by the scorer AND the actor.
## 🚨 This existed twice and the copies drifted: the scorer learned the heart is visible
## from further away, the actor did not, and the companion chose `investigate`, walked at
## a random point and never arrived. 48 of 90 samples in the right behaviour, closest
## approach 333px. It read as the feature working until somebody checked the distance.
func perceive(world) -> Dictionary:
	var g: float = gpu * (1.0 - Tuning.DUST_GPU_LOSS * world.dust_at(world.companion_pos))
	var near := []
	for t in world.threats:
		# ⚠ is_hostile, not `alive`. IND-34l's stopped ones share the type because they
		# are shootable salvage, and counting them made the companion fear furniture ...
		# worst of all it damped curiosity, so the objects that ARE the atmosphere were
		# switching the atmosphere system off.
		if world.is_hostile(t) and world.companion_pos.distance_to(t.pos) < g:
			near.append(t)
	near.sort_custom(func(a, b):
		return world.companion_pos.distance_to(a.pos) < world.companion_pos.distance_to(b.pos))

	var loot = null
	for s in world.salvage:
		if world.companion_pos.distance_to(s.pos) < g:
			if loot == null or world.companion_pos.distance_to(s.pos) < world.companion_pos.distance_to(loot.pos):
				loot = s

	var interesting = null
	for i in world.interest:
		# pull extends REACH as well as weight: a thing that insists harder is noticed
		# from further away. without it the heart moment was a coin flip.
		if not i.seen and world.companion_pos.distance_to(i.pos) < g * i.pull:
			interesting = i
			break

	return {
		"gpu": g, "near": near, "nearest": near[0] if near.size() > 0 else null,
		"dT": world.companion_pos.distance_to(near[0].pos) if near.size() > 0 else 99999.0,
		"loot": loot, "interesting": interesting,
	}


func score(world) -> Dictionary:
	var p := perceive(world)
	var g: float = p.gpu
	var dT: float = p.dT
	var nearest = p.nearest
	var dP: float = world.companion_pos.distance_to(world.player_pos)
	var player_hurt: float = 1.0 - world.player_hp / Tuning.PLAYER_HP
	var self_hurt: float = 1.0 - world.companion_hp / world.companion_max_hp
	var low: float = 1.0 if charge < 0.25 else 0.0

	var s := {}

	s[B.ENGAGE] = aggression * 1.15 * (clampf(1.0 - dT / g, 0.0, 1.0) if nearest else 0.0) \
		- caution * 0.55 * self_hurt - low * 0.7

	# 🚨 COVERING: "when you retreat, a brave companion advances", which IND-34c calls the
	# entire emotional engine of this game. It scored ZERO on every frame of the original
	# build, because `retreating` was assigned false every frame and set true nowhere.
	# ⚠ And bravery is `loyalty - caution` with NO coefficient. A `* 1.6` version ate 0.24
	# flat and stopped a machine carrying ATTENDANCE from ever advancing.
	s[B.COVER] = (loyalty - caution) * Tuning.COVER_GAIN \
		* (1.0 if world.player_retreating else 0.0) \
		* (clampf(1.0 - dT / Tuning.COVER_RANGE, 0.0, 1.0) if nearest else 0.0) \
		- low * 0.5

	s[B.REPAIR] = 0.0
	if can.repair:
		s[B.REPAIR] = player_hurt * 1.55 * (loyalty * 0.9 + 0.1) \
			- caution * 0.35 * (clampf(1.0 - dT / 200.0, 0.0, 1.0) if nearest else 0.0)

	s[B.SALVAGE] = 0.0
	if can.salvage and p.loot != null:
		s[B.SALVAGE] = 0.55 * (curiosity * 0.8 + 0.3) \
			- caution * 0.5 * (clampf(1.0 - dT / 190.0, 0.0, 1.0) if nearest else 0.0)

	# ⚠ curiosity was ARITHMETICALLY IMPOSSIBLE before the proximity term: investigate
	# peaked at 0.175 against a follow FLOOR of 0.285 and was never chosen once in 241
	# samples. No amount of play would ever have surfaced it.
	var afraid := false
	for t in world.threats:
		if world.is_hostile(t) and world.companion_pos.distance_to(t.pos) < Tuning.AFRAID_RANGE:
			afraid = true
			break
	if p.interesting != null:
		var dI: float = world.companion_pos.distance_to(p.interesting.pos)
		var pull: float = p.interesting.pull
		var damp: float = minf(1.0, Tuning.AFRAID_DAMP * pull) if afraid else 1.0
		s[B.INVESTIGATE] = curiosity * Tuning.INVESTIGATE_GAIN * pull \
			* clampf(1.0 - dI / (g * pull), 0.0, 1.0) * damp
	else:
		s[B.INVESTIGATE] = curiosity * 0.25 * (1.0 if p.near.is_empty() else 0.0)

	s[B.FLEE] = caution * 1.3 * self_hurt \
		+ (caution * 0.65 if (nearest and dT < 62.0) else 0.0) \
		+ low * 0.6 - loyalty * 0.55 * (1.0 if player_hurt > 0.5 else 0.0)

	# ⚠ a machine standing at your shoulder does not need to WANT to follow you. the old
	# hard floor of 0.32 was what made curiosity unreachable.
	s[B.FOLLOW] = Tuning.FOLLOW_FLOOR \
		+ clampf((dP - Tuning.FOLLOW_SLACK) / 240.0, 0.0, 1.0) * Tuning.FOLLOW_GAIN

	# jitter: never robotic
	for k in BEHAVIOURS:
		s[k] = maxf(0.0, s[k] + (randf() - 0.5) * 0.07)
	return s


func decide(world, dt: float) -> void:
	think -= dt
	if think > 0.0:
		return
	think = 0.10 / maxf(0.25, cpu)

	var raw := score(world)
	var ranked := BEHAVIOURS.duplicate()
	ranked.sort_custom(func(a, b): return raw[a] > raw[b])

	# 🚨 RAM. The warm set PERSISTS and loading a new behaviour takes time. The original
	# recomputed it every tick as the top-`ram` slice of the SAME ranking it was meant to
	# constrain, so ranked[0] was warm by construction and RAM gated nothing: the chosen
	# behaviour matched the top scorer in 241 of 241 samples.
	# ⚠ A limit derived from the thing it limits is not a limit.
	var was_warm_repair: bool = warm.has(B.REPAIR)
	if warm.is_empty():
		for i in mini(ram, ranked.size()):
			warm[ranked[i]] = true

	swap_cd = maxf(0.0, swap_cd - 0.10 / maxf(0.25, cpu))
	while warm.size() > ram:
		var worst = null
		for k in warm.keys():
			if worst == null or raw[k] < raw[worst]:
				worst = k
		warm.erase(worst)

	if swap_cd <= 0.0:
		var wants := []
		for i in mini(ram, ranked.size()):
			wants.append(ranked[i])
		var newcomer = null
		for b in wants:
			if not warm.has(b):
				newcomer = b
				break
		if newcomer != null:
			if warm.size() >= ram:
				var worst2 = null
				for k in warm.keys():
					if worst2 == null or raw[k] < raw[worst2]:
						worst2 = k
				warm.erase(worst2)
			warm[newcomer] = true
			swap_cd = Tuning.SWAP_WINDOW

	scores = raw
	var prev := behaviour
	behaviour = B.FOLLOW
	for b in ranked:
		if warm.has(b):
			behaviour = b
			break

	if was_warm_repair and not warm.has(B.REPAIR) and world.player_hp < Tuning.PLAYER_HP * 0.7:
		world.log_line("%s is too busy to help you." % world.companion_name())
	if prev != B.COVER and behaviour == B.COVER:
		world.log_line("%s moved in front of you." % world.companion_name())
	if prev != B.FLEE and behaviour == B.FLEE:
		world.log_line("%s broke off." % world.companion_name())


## IND-34a §it saves you. Capability, disposition, history ... and no die roll anywhere,
## because the same machine in the same state must make the same choice or a player can
## never learn what they BUILT rather than what they rolled.
func try_interpose(world, incoming: float) -> bool:
	if not can.interpose:
		return false
	if world.companion_pos.distance_to(world.player_pos) > Tuning.INTERPOSE_REACH:
		return false
	if world.player_hp - incoming > Tuning.PLAYER_HP * Tuning.INTERPOSE_DANGER:
		return false
	var history: float = minf(1.0, care_shown / Tuning.INTERPOSE_HISTORY_FULL)
	var willingness: float = loyalty * 1.0 + history * 0.9 - caution * 0.35
	if willingness < Tuning.INTERPOSE_BAR:
		return false
	# ⚠ it costs it the piece that LET it, not a random one.
	var slot := -1
	for i in installed.size():
		if installed[i] != null and installed[i].grants.has("interpose"):
			slot = i
			break
	if slot < 0:
		return false
	var used = installed[slot]
	installed[slot] = null
	recompute()
	# 🚨 plain. no fanfare, no explanation. the empty socket is the sentence.
	world.log_line("%s moved into it. %s is gone." % [world.companion_name(), used.name])
	return true
