extends RefCounted
class_name GameWorld

## THE HALT ... the port of src/game/world.ts, which is the reference implementation.
##
## IND-34b: a transit interchange where several thousand machines stopped mid-journey
## and never resumed. densely packed, mostly harmless. the density is the tutorial.
##
## ⚠ every measured number lives in Tuning. a literal that appears here appears in the
## web build at the same place; if the two ever disagree, the web build is right and
## this file has a bug.
##
## the mind (CompanionMind) holds the mental state; THIS holds the physical world and
## the companion's body. the mind reads the world through the exact surface the parity
## test proved: player_pos, companion_pos, threats[].pos, is_hostile, dust_at, log_line.


# ── entities ────────────────────────────────────────────────────────────────────

class Threat:
	var pos: Vector2
	var r := 10.0
	var hp := 30.0
	var max_hp := 30.0
	var speed := 0.5
	var wind := 0.0            ## the telegraph. built to be safe around humans.
	var striking := false
	var alive := true
	var kind := "runner"       ## runner | stopped | warden | caster | loop | scav | herder | pest | dray
	var seed_v := 0
	var announced := false
	var fire_cd := 0.0
	## IND-34l · wardens by degree. 1 is intact. 2 announced and CANNOT follow through.
	## 3 walks a perimeter of nothing. 4 engages only what has already stopped.
	var degree := 0
	var rearm_at := 0.0
	## the bestiary's extra registers
	var life := 0.0            ## loops: they burn out on their own
	var turn_at := 0.0         ## loops: a new heading every so often
	var heading := Vector2.RIGHT
	var stolen: Fragments.Frag = null   ## scavengers: the fragment they took, RUNNING in them
	var pulse_at := 0.0        ## herders: the herding pulse timer
	var home := Vector2.ZERO   ## wardens deg 3: the centre of their perimeter

class SalvageItem:
	var pos: Vector2
	var frag := ""             ## "" = bare scrap; else a Fragments catalogue id
	var worn := 0.0

class InterestItem:
	var pos: Vector2
	var seen := false
	var kind := "view"         ## view | arrangement | lamp
	## how hard it pulls. 1 is a nice view. ⚠ IND-34k's heart is the ONLY thing above 1.
	var pull := 1.0

class Wreck:
	var pos: Vector2
	var s := 10.0
	var seed_v := 0

class HandlerBody:
	var pos: Vector2
	var prev: Vector2
	var hp := 30.0
	var alive := true
	var r := 6.0
	var fire_cd := 0.0
	var bob := 0.0

class Bullet:
	var pos: Vector2
	var vel: Vector2
	var life := 1.0
	var from := "player"       ## player | comp | handler | threat

class WeatherBody:
	var pos: Vector2
	var vel: Vector2
	var r := 300.0
	var strength := 0.0
	var age := 0.0
	var life := 78.0


# ── the player ──────────────────────────────────────────────────────────────────

var player_pos := Vector2(Tuning.W / 2.0, Tuning.H / 2.0)
var player_prev := player_pos
var player_hp: float = Tuning.PLAYER_HP
var player_r := 8.0
var player_retreating := false
var last_hurt := -99.0
var heat := 0.0
var overheated := 0.0
var fire_cd := 0.0

# ── the companion: the mind thinks, the world carries the body ──────────────────

var mind: CompanionMind = null          ## null until the chassis is taken
var companion_pos := Vector2.ZERO
var companion_prev := Vector2.ZERO
var companion_r := 7.0
var companion_hp := 50.0
var companion_max_hp := 50.0
var comp_name := ""
var named := false
var exposure := 0.0
var repair_cd := 0.0
var poi_active := false
var poi := Vector2.ZERO

## IND-34c: it does not die with you. it stays where you fell, and it waits.
var waiting_mind: CompanionMind = null
var waiting_pos := Vector2.ZERO
var waiting_name := ""
var waiting_since := 0.0

# ── the run ─────────────────────────────────────────────────────────────────────

var run := 1
var run_started := 0.0
var records: Array = []                 ## { run, seconds, kept, deepest }
var deepest := 0.0
var death_flash := 0.0
var recall_flash := 0.0
var recall_count := 0
var abandoned := 0
var interposes := 0
var mending := 0.0

# ── the field ───────────────────────────────────────────────────────────────────

var threats: Array = []
var bullets: Array = []
var salvage: Array = []
var interest: Array = []
var wrecks: Array = []
var pack: Array = []                    ## carried. AT RISK. death takes all of it.
var banked: Array = []                  ## carried home. SAFE. the recall's only purchase.
var chassis_pos := Vector2.ZERO
var chassis_taken := false
var has_chassis := true
var weather: WeatherBody = null
var weather_timer := 55.0

var handler: HandlerBody = null
var handler_met := false
var handler_met_at := -1.0
var handler_lost_at := -1.0
var warden_spawned := false

var t := 0.0
var logs: Array = []                    ## { text, t }
var spawn_timer := 3.0
var anchor := Vector2(Tuning.W / 2.0, Tuning.H / 2.0)

## receipts the scene consumes each frame: sound cues + positioned vfx + hitstop
var sounds: Array = []
var vfx: Array = []                     ## { kind, pos, ... } drained by the scene
var hitstop_s := 0.0

# ── THE STORYLINE (IND-34q / 34f / 34b / 34r) ───────────────────────────────────
## 🚨 the machine beside you at wake. broken, dormant, saying one thing. the game
## never explains it. the player who finishes the game will understand it; the
## player who does not will still have felt it (34q: the rhyme carries either way).
var dormant_pos := Vector2(Tuning.W / 2.0 - 120.0, Tuning.H / 2.0 + 60.0)
var dormant_next := 2.0
var dormant_line := ""

## the still (34b): they walked here. rows, neat, facing one direction. the best
## fragments in the game, because they are whole and were not torn out of anything.
## 🚨 taking from it is the moral centre of the world and the game never comments.
var still_rows: Array = []              ## [{ pos, seed_v, taken }]
var still_at := Vector2(240.0, 160.0)
var still_found := false

## the repair unit (34f): it will fix your companion. free. fully. and it will not
## stop offering, every time you pass, forever.
var repair_pos := Vector2(980.0, 240.0)
var repair_next := 0.0

## the foreman (34f): assigns from a manifest dated before the Scatter. the work
## order is a physical thing in your pack. there is nothing to report to ... you
## go back, and it checks.
var foreman_pos := Vector2(1180.0, 980.0)
var work_order := false
var work_done := 0
var work_handed_in := false
var manifest_done := 0                  ## of FOREMAN_MANIFEST; finishing it matters
var foreman_finished := false           ## it logs its last line and powers down

## the commissary (34f): fixed inventory, decades old, priced in a currency that
## stopped meaning anything. it accepts salvage at a rate it invented. the rate
## is bad, and it is not negotiable.
var commissary_pos := Vector2(420.0, 1020.0)
var scrip := 0                          ## it calls the salvage you feed it "scrip"

## 🚨 THE DOOR (34r). the landmark's threshold. passable when the build is real
## enough to survive getting there. it never asks. walking in ends the run you
## were in and begins what the game never names.
var door_pos := Vector2(Tuning.W - 60.0, 600.0)
var ascended := false

## the handler by degree (34l #2): it will not leave. it is waiting for someone.
## you cannot call it, cannot lead it, cannot pick it up. you can strip it for
## parts; it will not resist; it will still be facing the door.
var waiting_dog_pos := Tuning.WAITING_HANDLER_POS
var waiting_dog_taken := false
var waiting_dog_found := false

## what is buried (34i §2): pre-Scatter salvage, WHOLE, under the field. no marker,
## no ping. a curious companion stops over one and digs. a dull one walks past
## everything buried in the game and never mentions it.
var buried: Array = []                  ## { pos, frag, dig, done }
var dig_t := 0.0

var spawn_rng: Lcg = Lcg.from_string("halt-spawns")


func _init() -> void:
	generate()


# ── the shared predicates the mind reads ────────────────────────────────────────

## 🚨 is this a THREAT, or furniture in the same array? IND-34l's stopped ones are
## shootable salvage, not danger. one predicate; a fourth kind declares itself here.
func is_hostile(th) -> bool:
	return th.alive and th.kind != "stopped"


func dust_at(p: Vector2) -> float:
	if weather == null:
		return 0.0
	var d := p.distance_to(weather.pos)
	if d > weather.r:
		return 0.0
	return minf(1.0, (1.0 - d / weather.r) * 1.8) * weather.strength


func companion_name() -> String:
	return comp_name if comp_name != "" else "it"


func log_line(text: String) -> void:
	# ⚠ a repeated line refreshes its timestamp instead of stacking. "it broke off."
	# six times in a row trains the player to stop reading the log, which costs every
	# message that matters ... including the ones the gate depends on.
	if logs.size() > 0 and logs[0].text == text and t - logs[0].t < 8.0:
		logs[0].t = t
		return
	logs.push_front({ "text": text, "t": t })
	if logs.size() > 6:
		logs.pop_back()


func cue(name: String) -> void:
	sounds.append(name)


func fx(kind: String, pos: Vector2, extra := {}) -> void:
	var e := { "kind": kind, "pos": pos }
	e.merge(extra)
	vfx.append(e)


func hitstop(ms: float) -> void:
	hitstop_s = maxf(hitstop_s, ms / 1000.0)


# ── generation ──────────────────────────────────────────────────────────────────

func generate() -> void:
	var r := Lcg.from_string("the-halt")
	# ten thousand stopped machines, rendered as a field of wrecks
	for i in 340:
		var wk := Wreck.new()
		wk.pos = Vector2(r.next() * Tuning.W, r.next() * Tuning.H)
		wk.s = 6.0 + r.next() * 14.0
		wk.seed_v = int(r.next() * 1000.0)
		wrecks.append(wk)

	# THE OPENING. findability is not polish at P0, it is whether the game has an
	# opening at all: the chassis visible from spawn, a trail of salvage to it.
	chassis_pos = Vector2(Tuning.W / 2.0 + 150.0, Tuning.H / 2.0 - 95.0)
	var trail := 7
	for i in trail:
		var tt := float(i + 1) / float(trail + 1)
		var sv := SalvageItem.new()
		sv.pos = Vector2(
			Tuning.W / 2.0 + 150.0 * tt + (r.next() - 0.5) * 54.0,
			Tuning.H / 2.0 - 95.0 * tt + (r.next() - 0.5) * 54.0)
		sv.frag = "attend" if i == trail - 1 else ""   # the first fragment sits ON the chassis
		salvage.append(sv)
	# and the rest of the zone, scattered but reachable
	var openers := ["repair", "prudence", "pursuit", "inquiry", "ward"]
	for i in 16:
		var a := r.next() * TAU
		var d := 210.0 + r.next() * 430.0
		var sv2 := SalvageItem.new()
		sv2.pos = Vector2(
			clampf(Tuning.W / 2.0 + cos(a) * d, 40.0, Tuning.W - 40.0),
			clampf(Tuning.H / 2.0 + sin(a) * d, 40.0, Tuning.H - 40.0))
		sv2.frag = openers[i] if i < 5 else ""
		salvage.append(sv2)

	# things worth nothing. one close, so the category is learnable.
	var lamp := InterestItem.new()
	lamp.pos = Vector2(Tuning.W / 2.0 - 190.0, Tuning.H / 2.0 + 130.0)
	lamp.kind = "lamp"
	interest.append(lamp)
	var kinds := ["view", "arrangement", "lamp"]
	for i in 8:
		var it := InterestItem.new()
		it.pos = Vector2(110.0 + r.next() * (Tuning.W - 220.0), 110.0 + r.next() * (Tuning.H - 220.0))
		it.kind = kinds[int(r.next() * 3.0)]
		interest.append(it)

	# IND-34k step 3: THE CORRIDOR. things already destroyed, in a line, leading east.
	for i in 26:
		var tt2 := float(i) / 25.0
		var wk2 := Wreck.new()
		wk2.pos = Vector2(
			860.0 + tt2 * 620.0 + (r.next() - 0.5) * 70.0,
			Tuning.H / 2.0 + sin(tt2 * 2.4) * 90.0 + (r.next() - 0.5) * 80.0)
		wk2.s = 9.0 + r.next() * 13.0
		wk2.seed_v = int(r.next() * 1000.0)
		wrecks.append(wk2)

	# deeper is worth it. that is the whole economy.
	var deep_frags := ["inquiry", "pursuit", "prudence", "brace", "ward", "mark", "salvage"]
	for i in 11:
		var sv3 := SalvageItem.new()
		sv3.pos = Vector2(
			Tuning.DEEP_X + 60.0 + r.next() * (Tuning.W - Tuning.DEEP_X - 140.0),
			110.0 + r.next() * (Tuning.H - 220.0))
		sv3.frag = deep_frags[i] if i < 7 else ""
		salvage.append(sv3)

	# ── IND-34l · THE ONES THAT GAVE UP. still ON. found individually, never grouped. ──
	var spots := [Vector2(300, 260), Vector2(1180, 250), Vector2(430, 980),
		Vector2(1420, 900), Vector2(900, 190), Vector2(1300, 640)]
	for s in spots:
		var st := Threat.new()
		st.pos = s + Vector2((r.next() - 0.5) * 90.0, (r.next() - 0.5) * 90.0)
		st.r = 11.0
		st.hp = 30.0
		st.max_hp = 30.0
		st.speed = 0.0
		st.kind = "stopped"
		st.seed_v = int(r.next() * 1000.0)
		threats.append(st)

	# ⚠ IND-34l: rare, unmarked, placed where nobody has a reason to be. the broken one.
	var bw := Threat.new()
	bw.pos = Vector2(1460, 1080)
	bw.r = 26.0
	bw.hp = 340.0
	bw.max_hp = 340.0
	bw.speed = 0.0
	bw.kind = "warden"
	bw.seed_v = 12
	bw.degree = 2
	threats.append(bw)

	# ── THE STORYLINE GENERATION ──
	# the still (34b): rows, neat, facing one direction. found, never signposted.
	# placed far northwest, where nobody has a reason to go early.
	for row in 3:
		for col in 5:
			var st := {
				"pos": still_at + Vector2(col * 46.0, row * 60.0),
				"seed_v": 7000 + row * 5 + col,
				"taken": false,
			}
			still_rows.append(st)

	# the dormant one beside you (34q). it is drawn by the scene; it says one thing
	# on a timer, and the timer is the only script it has.
	dormant_line = "return."

	# what is buried (34i §2): scattered wide, deeper east, never marked. the
	# fragments are WHOLE ... buried things predate the Scatter.
	var br := Lcg.from_string("what-is-buried")
	for i in Tuning.BURIED_N:
		buried.append({
			"pos": Vector2(500.0 + br.next() * (Tuning.W - 700.0), 120.0 + br.next() * (Tuning.H - 240.0)),
			"frag": ["mark", "salvage", "inquiry", "brace", "attend", "pursuit", "prudence"][i],
			"dig": 0.0,
			"done": false,
		})

	for i in 5:
		spawn_threat()


func spawn_threat() -> void:
	# ⚠ threats are built for where the PLAYER is, not the edge they walk in from.
	var d := Tuning.depth_at(player_pos.x)
	var r := spawn_rng
	# ── the bestiary table (IND-34b/34i/34j/34l). depth owns the mix: the shallows
	# teach walking and dodging; the deep is where everything else lives. ──
	var roll := r.next()
	if d > 0.45 and roll < 0.10:
		_spawn_loop(d)
		return
	if d > 0.30 and roll < 0.22 and mind != null:
		_spawn_scav(d)
		return
	if d > 0.25 and roll < 0.30:
		_spawn_herder(d)
		return
	if d > 0.20 and roll < 0.42:
		_spawn_pests(d, 2 + int(r.next() * 2.0))
		return
	var edge := int(r.next() * 4.0)
	var p: Vector2
	match edge:
		0: p = Vector2(r.next() * Tuning.W, -30)
		1: p = Vector2(Tuning.W + 30, r.next() * Tuning.H)
		2: p = Vector2(r.next() * Tuning.W, Tuning.H + 30)
		_: p = Vector2(-30, r.next() * Tuning.H)
	# casters only exist past the shallows: the first thing a player learns is walking,
	# the second is that walking stops being enough.
	var caster := d > 0.34 and roll < 0.22 + d * 0.26
	var th := Threat.new()
	th.pos = p
	th.r = 9.0 if caster else 10.0
	th.hp = (20.0 + d * 26.0) if caster else (24.0 + d * 30.0)
	th.max_hp = th.hp
	th.speed = (0.34 + r.next() * 0.2) if caster else (0.5 + r.next() * 0.35)
	th.kind = "caster" if caster else "runner"
	th.seed_v = int(r.next() * 1000.0)
	th.fire_cd = 1.2 + r.next()
	threats.append(th)


## IND-34b: stuck repeating a fragment of an action. erratic, fast, unreadable,
## short-lived. 🚨 the only genuinely chaotic thing in the world ... and it burns out
## on its own, which is the saddest possible version of an enemy.
func _spawn_loop(d: float) -> void:
	var r := spawn_rng
	var th := Threat.new()
	th.pos = _edge_point(r)
	th.r = 8.0
	th.hp = 14.0 + d * 10.0
	th.max_hp = th.hp
	th.speed = Tuning.LOOP_SPEED * (0.85 + r.next() * 0.3)
	th.kind = "loop"
	th.seed_v = int(r.next() * 1000.0)
	th.life = Tuning.LOOP_LIFE * (0.7 + r.next() * 0.6)
	th.heading = Vector2.RIGHT.rotated(r.next() * TAU)
	th.turn_at = 0.0
	threats.append(th)


## IND-34b/34i: other assemblers. it watches, it closes when you are busy, it takes a
## fragment ... and it RUNS it: its behaviour changes to reflect what it stole. 🚨 the
## floor holds absolutely: only a socket filled within SCAV_WINDOW can be taken, so a
## settled companion is never at risk.
func _spawn_scav(d: float) -> void:
	var r := spawn_rng
	var th := Threat.new()
	th.pos = _edge_point(r)
	th.r = 11.0
	th.hp = 40.0 + d * 30.0
	th.max_hp = th.hp
	th.speed = Tuning.SCAV_SPEED
	th.kind = "scav"
	th.seed_v = int(r.next() * 1000.0)
	threats.append(th)


## IND-34j: livestock handlers moving in patterns around nothing. they will try to
## move YOU, which is not an attack and is very nearly worse.
func _spawn_herder(d: float) -> void:
	var r := spawn_rng
	var th := Threat.new()
	th.pos = _edge_point(r)
	th.r = 14.0
	th.hp = 46.0 + d * 20.0
	th.max_hp = th.hp
	th.speed = 0.8 + r.next() * 0.3
	th.kind = "herder"
	th.seed_v = int(r.next() * 1000.0)
	th.pulse_at = t + 2.0 + r.next() * 3.0
	threats.append(th)


## IND-34j: agricultural pest control that now classifies everything as pest.
## small, fast, many.
func _spawn_pests(d: float, n: int) -> void:
	var r := spawn_rng
	var base := _edge_point(r)
	for i in n:
		var th := Threat.new()
		th.pos = base + Vector2((r.next() - 0.5) * 90.0, (r.next() - 0.5) * 90.0)
		th.r = 6.0
		th.hp = 10.0 + d * 6.0
		th.max_hp = th.hp
		th.speed = Tuning.PEST_SPEED * (0.85 + r.next() * 0.3)
		th.kind = "pest"
		th.seed_v = int(r.next() * 1000.0)
		threats.append(th)


## IND-34j: heavy haulers. hazards by mass rather than aggression ... they walk their
## line, and you are standing in it or you are not.
func spawn_dray(line_y: float) -> void:
	var r := spawn_rng
	var th := Threat.new()
	th.pos = Vector2(-60.0, line_y)
	th.home = Vector2(Tuning.W + 60.0, line_y)
	th.r = 22.0
	th.hp = 220.0
	th.max_hp = 220.0
	th.speed = Tuning.DRAY_SPEED
	th.kind = "dray"
	th.seed_v = int(r.next() * 1000.0)
	threats.append(th)


func _edge_point(r: Lcg) -> Vector2:
	var edge := int(r.next() * 4.0)
	match edge:
		0: return Vector2(r.next() * Tuning.W, -30)
		1: return Vector2(Tuning.W + 30, r.next() * Tuning.H)
		2: return Vector2(r.next() * Tuning.W, Tuning.H + 30)
		_: return Vector2(-30, r.next() * Tuning.H)


func spawn_handler() -> void:
	if handler != null or handler_met:
		return
	var h := HandlerBody.new()
	h.pos = Vector2(
		clampf(player_pos.x - 120.0, 40.0, Tuning.W - 40.0),
		clampf(player_pos.y + 90.0, 40.0, Tuning.H - 40.0))
	h.prev = h.pos
	handler = h
	handler_met = true
	handler_met_at = t
	log_line("something small is following you.")


## 🚨 THE PERMANENT RULE, not a scripted death. a warden one-shots a handler. always,
## everywhere, forever. it kills the dog with exactly as much feeling as a crate.
func kill_handler() -> void:
	if handler == null or not handler.alive:
		return
	handler.alive = false
	handler_lost_at = t
	hitstop(160)
	cue("destroy")
	# IND-34k: the moment itself. one ring of light leaving the body, and the screen
	# agrees with what just happened. ⚠ no foreshadowing anywhere before this line ...
	# the beat lands BECAUSE nothing advertised it.
	fx("heartdrop", handler.pos)
	# IND-34k: something in it is still on. the first glowing fragment the player ever
	# sees, and it belonged to someone they knew.
	var sv := SalvageItem.new()
	sv.pos = handler.pos
	sv.frag = "heart"
	sv.worn = 1.0
	salvage.append(sv)
	# and the companion's OWN curiosity brings it there. not scripted ... pull.
	var it := InterestItem.new()
	it.pos = handler.pos
	it.kind = "lamp"
	it.pull = Tuning.HEART_PULL
	interest.append(it)
	log_line("it stops moving.")


func spawn_weather() -> void:
	var r := spawn_rng
	var from_west := r.next() < 0.5
	var wx := WeatherBody.new()
	wx.pos = Vector2(-320.0 if from_west else Tuning.W + 320.0, 200.0 + r.next() * (Tuning.H - 400.0))
	wx.r = 300.0 + r.next() * 190.0
	wx.vel = Vector2((1.0 if from_west else -1.0) * (17.0 + r.next() * 12.0), (r.next() - 0.5) * 9.0)
	wx.life = 78.0 + r.next() * 40.0
	weather = wx
	log_line("there is dust on the horizon.")


func spawn_warden() -> void:
	if warden_spawned:
		return
	warden_spawned = true
	var th := Threat.new()
	th.pos = Vector2(
		clampf(player_pos.x + 300.0, 40.0, Tuning.W - 40.0),
		clampf(player_pos.y - 60.0, 40.0, Tuning.H - 40.0))
	th.r = 26.0
	th.hp = 340.0
	th.max_hp = 340.0
	th.speed = 0.42
	th.kind = "warden"
	th.seed_v = 7
	th.degree = 1
	threats.append(th)


## leaving the site, however you left it. ONE implementation ... the recall and dying
## drifted apart once (dying deleted the warden forever) and must not again.
func reset_site() -> void:
	var keep := threats.filter(func(th): return th.alive and (th.kind == "warden" or th.kind == "stopped"))
	threats = []
	for k in keep:
		if k.kind == "warden" and k.degree != 2:
			k.pos.x = clampf(maxf(k.pos.x, Tuning.DEEP_X + 120.0), 40.0, Tuning.W - 40.0)
		k.wind = 0.0
		k.striking = false
		threats.append(k)
	spawn_timer = 4.0
	bullets = []


## IND-34c: the single most important mechanic in the game. instant, always available,
## never blocked. ⚠ NEVER add a cooldown, a channel, or a boss-room block. what it BUYS
## is the bank; without the bank it is a teleport and the risk economy is decorative.
func recall() -> void:
	var left := 0
	for s in salvage:
		if s.pos.distance_to(player_pos) < 420.0:
			left += 1
	abandoned += left

	var carried := pack.size()
	for f in pack:
		banked.append(f)
	pack = []

	player_prev = player_pos
	player_pos = anchor
	if mind != null:
		companion_pos = anchor + Vector2(20, 20)
		companion_prev = companion_pos

	reset_site()
	recall_flash = 1.0
	recall_count += 1
	cue("recall")
	fx("recall", anchor)
	if carried > 0:
		log_line("you left. %d kept%s." % [carried, (", %d still out there" % left) if left > 0 else ""])
	else:
		log_line("you left with nothing. %d still out there." % left if left > 0 else "you left.")


## IND-34c §what death means. character gone, gear gone (banked TOO), fame recorded,
## start again. 🚨 and your companion does not die. it stays where you fell. it waits.
func die() -> void:
	records.push_front({
		"run": run, "seconds": roundi(t - run_started),
		"kept": banked.size(), "deepest": roundi(deepest),
	})
	if records.size() > 5:
		records.pop_back()

	if mind != null:
		waiting_mind = mind
		waiting_pos = player_pos
		waiting_name = comp_name
		waiting_since = t
		mind.behaviour = CompanionMind.B.FOLLOW
		mind.warm.clear()
		mind.swap_cd = 0.0
		companion_hp = companion_max_hp
		mind = null

	pack = []
	banked = []      # ⚠ BOTH. banked is safe from a recall, not from dying.
	handler = null   # somebody else's machine, and it does not survive you either.

	run += 1
	run_started = t
	deepest = 0.0
	player_hp = Tuning.PLAYER_HP
	heat = 0.0
	overheated = 0.0
	player_pos = anchor
	player_prev = anchor
	reset_site()
	death_flash = 1.0
	hitstop(320)
	cue("destroy")
	log_line("you die here.")
	if waiting_mind != null:
		log_line("it is still standing where you fell.")


## going back for it. no prompt, no marker ... you walk to where you died and it is there.
## ⚠ it does not simply resume: fragments intact, and it follows a NEW person cautiously.
func retrieve() -> void:
	if waiting_mind == null or mind != null:
		return
	mind = waiting_mind
	mind.bond = Tuning.BOND_ON_RETRIEVE
	mind.recompute()
	comp_name = waiting_name
	companion_pos = waiting_pos
	companion_prev = waiting_pos
	waiting_mind = null
	cue("stand")
	log_line("%s follows you. not like before." % companion_name())


func take_chassis() -> void:
	if not has_chassis or chassis_taken:
		return
	chassis_taken = true
	mind = CompanionMind.new()
	mind.installed = [null, null, null]
	mind.install(Fragments.make("gait"), 0, t)   # it can move. that is all, at first.
	mind.recompute()
	companion_pos = chassis_pos + Vector2(0, 20)
	companion_prev = companion_pos
	companion_hp = companion_max_hp
	cue("stand")
	log_line("it stands up.")


# ── damage doors. one for the player, one for the threats. never a third path. ──

func hurt_player(dmg: float, stop_ms: float) -> void:
	if mind != null and mind.try_interpose(self, dmg):
		# it costs the machine the hit AND the piece that let it (mind consumed it).
		companion_hp = maxf(1.0, companion_hp - dmg)
		last_hurt = t
		hitstop(260)
		cue("destroy")
		interposes += 1
		return
	player_hp -= dmg
	last_hurt = t
	cue("hurt")
	fx("playerhurt", player_pos)
	hitstop(stop_ms)


## 🚨 the single damage door for threats. death happens HERE, whoever caused it,
## whatever branch the behaviour was in. the web build shipped an immortal machine
## (the degree-2 warden) by scattering death checks under `continue`s. never again,
## in either engine.
func hurt_threat(th, dmg: float) -> void:
	if not th.alive:
		return
	th.hp -= dmg
	if th.hp > 0.0:
		return
	th.alive = false
	cue("destroy")
	fx("destroy", th.pos, { "r": th.r, "warden": th.kind == "warden" })
	if th.kind == "stopped":
		# IND-34l: the intact ones are BETTER salvage. the game never comments.
		var a := SalvageItem.new()
		a.pos = th.pos + Vector2(-9, 0)
		a.frag = pick_frag()
		salvage.append(a)
		var b := SalvageItem.new()
		b.pos = th.pos + Vector2(9, 6)
		b.frag = pick_frag()
		salvage.append(b)
	elif th.kind == "warden":
		var w := SalvageItem.new()
		w.pos = th.pos
		w.frag = "selfpres"
		salvage.append(w)
		hitstop(220)
	elif th.kind == "caster":
		var c := SalvageItem.new()
		c.pos = th.pos
		c.frag = pick_frag() if randf() < 0.30 else ""
		salvage.append(c)
	else:
		# ⚠ IND-34i: better salvage under bad weather. the whole risk economy in a line.
		var odds := 0.22 + dust_at(th.pos) * 0.34
		var s := SalvageItem.new()
		s.pos = th.pos
		s.frag = pick_frag() if randf() < odds else ""
		salvage.append(s)


func pick_frag() -> String:
	return Fragments.ROLLABLE[randi() % Fragments.ROLLABLE.size()]


# ── the care loop the interposition reads (IND-34a §3 history) ─────────────────

func do_mend(dt: float, holding: bool) -> void:
	if mind == null or not holding or companion_pos.distance_to(player_pos) > Tuning.MEND_REACH or companion_hp >= companion_max_hp:
		mending = 0.0
		return
	mending += dt
	companion_hp = minf(companion_max_hp, companion_hp + dt * Tuning.MEND_RATE)
	var hurt := 1.0 - companion_hp / companion_max_hp
	# ⚠ repairing next to a machine that gave up is not brave, it is quiet.
	var danger := 1.0
	for th in threats:
		if is_hostile(th) and th.pos.distance_to(player_pos) < 220.0:
			danger = Tuning.CARE_DANGER_MULT
			break
	mind.care_shown += dt * Tuning.CARE_RATE * (0.35 + hurt) * danger
	if companion_hp >= companion_max_hp and mending > 0.2:
		log_line("%s is whole again." % companion_name())
		mending = 0.0


# ── the companion acts on what it decided. it is never commanded. ──────────────

func act_companion(dt: float) -> void:
	var c := mind
	var speed := 1.55 * 60.0 * dt
	var per := c.perceive(self)
	var th = per.nearest
	var loot = per.loot
	var interesting = per.interesting

	# behaviour-default: follow ... the target before the switch runs, declared.
	var target := player_pos + Vector2(0, 26)
	exposure = 0.0
	match c.behaviour:
		CompanionMind.B.ENGAGE:
			if th != null:
				target = th.pos
				exposure = 0.8
		CompanionMind.B.COVER:
			if th != null:
				target = th.pos + (player_pos - th.pos) * 0.3
				exposure = 1.0
		CompanionMind.B.REPAIR:
			target = player_pos
			exposure = 0.5
		CompanionMind.B.SALVAGE:
			if loot != null:
				target = loot.pos
				exposure = 0.35
		CompanionMind.B.INVESTIGATE:
			if interesting != null:
				target = interesting.pos
			else:
				if not poi_active or companion_pos.distance_to(poi) < 26.0:
					poi = Vector2(60.0 + randf() * (Tuning.W - 120.0), 60.0 + randf() * (Tuning.H - 120.0))
					poi_active = true
				target = poi
		CompanionMind.B.FLEE:
			var away_from = th.pos if th != null else player_pos
			target = companion_pos + (companion_pos - away_from)

	companion_prev = companion_pos
	var d := companion_pos.distance_to(target)
	if d > 4.0:
		companion_pos += (target - companion_pos) / d * speed
	companion_pos = companion_pos.clamp(Vector2(12, 12), Vector2(Tuning.W - 12, Tuning.H - 12))

	# ── MARKING (IND-34c). no marker, no line. it looks, and you learn to read it. ──
	c.marked = null
	if c.can.mark:
		var reach: float = c.gpu * Tuning.MARK_REACH_MULT * (1.0 - 0.5 * dust_at(companion_pos))
		var best = null
		var best_d := reach
		for th2 in threats:
			if not is_hostile(th2):
				continue
			if player_pos.distance_to(th2.pos) < Tuning.MARK_OBVIOUS:
				continue   # already on screen and your own problem
			var dc := companion_pos.distance_to(th2.pos)
			if dc < best_d:
				best_d = dc
				best = th2
		if best != null:
			c.marked = { "pos": best.pos }

	# face what it noticed; otherwise face where it is going
	var fv: Vector2
	if c.marked != null:
		fv = c.marked.pos - companion_pos
	elif d > 4.0:
		fv = target - companion_pos
	else:
		fv = player_pos - companion_pos
	if fv != Vector2.ZERO:
		var want := fv.angle()
		var diff := fposmod(want - c.facing + PI * 3.0, TAU) - PI
		c.facing += diff * minf(1.0, dt * 7.0)

	# battery: sustained activity drains, standing near the player recovers. ⚠ scaled
	# by CAPACITY ... a declared organ nothing read, once.
	var busy: bool = c.behaviour in [CompanionMind.B.ENGAGE, CompanionMind.B.COVER, CompanionMind.B.FLEE]
	var cap: float = maxf(0.35, c.battery)
	c.charge = clampf(c.charge + (-dt * 0.10 / cap if busy else dt * 0.16 * cap), 0.0, 1.0)

	# melee, through the door. never a raw subtraction.
	if c.behaviour == CompanionMind.B.ENGAGE and th != null and companion_pos.distance_to(th.pos) < 30.0:
		hurt_threat(th, 20.0 * dt)
	if c.behaviour == CompanionMind.B.COVER and th != null and companion_pos.distance_to(th.pos) < 44.0:
		hurt_threat(th, 9.0 * dt)

	if c.behaviour == CompanionMind.B.REPAIR and companion_pos.distance_to(player_pos) < 30.0 \
			and repair_cd <= 0.0 and player_hp < Tuning.PLAYER_HP:
		player_hp = minf(Tuning.PLAYER_HP, player_hp + 15.0)
		repair_cd = 2.4
		cue("repair")
	repair_cd = maxf(0.0, repair_cd - dt)

	if c.behaviour == CompanionMind.B.SALVAGE and loot != null and companion_pos.distance_to(loot.pos) < 16.0:
		if loot.frag != "":
			pack.append(Fragments.make(loot.frag, loot.worn))
		salvage.erase(loot)
		cue("pickup")

	# IND-34m: it stops at a thing worth nothing, and that is the only acknowledgement
	# the beautiful thing ever gets.
	if c.behaviour == CompanionMind.B.INVESTIGATE and interesting != null \
			and companion_pos.distance_to(interesting.pos) < 22.0:
		interesting.seen = true
		log_line("%s stopped, and looked at something." % companion_name())


## the handler. it follows, and it fights a little, badly. ⚠ it must be genuinely good
## company on its own terms ... if it is only there to die, players feel handled.
func act_handler(dt: float) -> void:
	var h := handler
	h.prev = h.pos
	h.bob += dt * 7.0
	h.fire_cd = maxf(0.0, h.fire_cd - dt)

	# ⚠ it does not charge machines that gave up. it is brave, not confused.
	var th = null
	var th_d := 230.0
	for th2 in threats:
		if is_hostile(th2):
			var d2 := h.pos.distance_to(th2.pos)
			if d2 < th_d:
				th_d = d2
				th = th2

	# ⚠ it goes AT things. a handler that hangs back is not a handler, it is an escort
	# mission ... and the version that trailed 42px behind let the PLAYER die to the
	# warden while the dog stood safely in the back.
	var target: Vector2 = th.pos if th != null else player_pos
	var dT := h.pos.distance_to(target)
	var stop := 52.0 if th != null else 42.0
	if dT > stop:
		var sp: float = minf(2.4, 1.55 + dT * 0.006) * 60.0 * dt
		h.pos += (target - h.pos) / dT * sp
	h.pos = h.pos.clamp(Vector2(12, 12), Vector2(Tuning.W - 12, Tuning.H - 12))

	if th != null and h.fire_cd <= 0.0:
		var a: float = (th.pos - h.pos).angle() + (randf() - 0.5) * 0.34   # badly
		var b := Bullet.new()
		b.pos = h.pos
		b.vel = Vector2(cos(a), sin(a)) * 330.0
		b.life = 0.8
		b.from = "handler"
		bullets.append(b)
		h.fire_cd = 0.55
		cue("fire")


# ── the tick. the port of simulate(). ───────────────────────────────────────────

func tick(dt: float, mv: Vector2, firing: bool, aim: Vector2, recalling := false, mend_held := false) -> void:
	t += dt

	# ⚠ handled FIRST. the recall is instant or it is not a recall.
	if recalling:
		recall()
	recall_flash = maxf(0.0, recall_flash - dt * 2.2)
	death_flash = maxf(0.0, death_flash - dt * 0.42)   # slow. it should sit on you.

	# ── player ──
	player_prev = player_pos
	player_pos = (player_pos + mv * 2.5 * 60.0 * dt).clamp(Vector2(12, 12), Vector2(Tuning.W - 12, Tuning.H - 12))

	# 🚨 ARE YOU FALLING BACK? inferred, never a button. `p.retreating = false` with no
	# writer is how COVERING ... the entire emotional engine ... scored zero forever.
	var near_t = null
	var near_d := INF
	for th in threats:
		if not is_hostile(th):
			continue
		var d := player_pos.distance_to(th.pos)
		if d < near_d:
			near_d = d
			near_t = th
	if near_t != null and mv != Vector2.ZERO and near_d < Tuning.RETREAT_RANGE:
		var away: Vector2 = (player_pos - near_t.pos) / maxf(near_d, 1.0)
		player_retreating = mv.dot(away) > Tuning.RETREAT_DOT
	else:
		player_retreating = false

	# IND-34j: heat, not ammo. ⚠ holding the trigger must NOT cool the driver.
	fire_cd = maxf(0.0, fire_cd - dt)
	overheated = maxf(0.0, overheated - dt)
	if firing and overheated <= 0.0:
		if fire_cd <= 0.0:
			var a := (aim - player_pos).angle()
			var b := Bullet.new()
			b.pos = player_pos
			b.vel = Vector2(cos(a), sin(a)) * 420.0
			b.life = 1.1
			b.from = "player"
			bullets.append(b)
			fire_cd = Tuning.FIRE_CD
			heat = minf(1.0, heat + Tuning.HEAT_PER_SHOT)
			cue("fire")
			fx("muzzle", player_pos, { "dir": a })
			if heat >= 1.0:
				overheated = Tuning.OVERHEAT_LOCK
				heat = 1.0
				cue("overheat")
				log_line("the driver is too hot to fire.")
	else:
		heat = maxf(0.0, heat - dt * (Tuning.HEAT_COOL_LOCKED if overheated > 0.0 else Tuning.HEAT_COOL))

	# ── bullets ──
	for i in range(bullets.size() - 1, -1, -1):
		var b2: Bullet = bullets[i]
		b2.pos += b2.vel * dt
		b2.life -= dt
		if b2.life <= 0.0 or b2.pos.x < 0.0 or b2.pos.y < 0.0 or b2.pos.x > Tuning.W or b2.pos.y > Tuning.H:
			bullets.remove_at(i)
			continue
		if b2.from == "threat":
			# IND-34n: incoming fire hits the player and the companion and nothing else,
			# so a caster is a threat to dodge rather than a threat to out-position.
			if b2.pos.distance_to(player_pos) < player_r + 5.0:
				bullets.remove_at(i)
				hurt_player(Tuning.caster_damage(Tuning.depth_at(player_pos.x)), 50)
				continue
			if mind != null and b2.pos.distance_to(companion_pos) < companion_r + 5.0:
				companion_hp -= Tuning.caster_damage(Tuning.depth_at(player_pos.x))
				bullets.remove_at(i)
				cue("hurt")
			continue
		for th2 in threats:
			if not th2.alive or b2.pos.distance_to(th2.pos) > th2.r + 3.0:
				continue
			hurt_threat(th2, 12.0)
			bullets.remove_at(i)
			hitstop(90 if not th2.alive else 40)   # game-feel: hitstop before particles
			cue("hit")
			fx("hit", b2.pos)
			break

	# ── threats. they telegraph enormously ... built to be safe around humans. ──
	for th3 in threats:
		if not th3.alive:
			continue
		# ⚠ IND-34l: the ones that gave up do not react. to anything. skipped before ANY
		# behaviour, because a stopped machine that flinches has noticed, and the moment
		# one notices the register collapses into pathos.
		if th3.kind == "stopped":
			continue
		var warden: bool = th3.kind == "warden"

		# IND-34k step 5: it announces itself. politely. it is doing its job.
		if warden and not th3.announced and th3.pos.distance_to(player_pos) < 620.0:
			th3.announced = true
			cue("announce")
			log_line("UNIT 12. AREA IS BEING CLEARED. PLEASE STAND AWAY." if th3.degree == 2
				else "UNIT 7. AREA IS BEING CLEARED. PLEASE STAND AWAY.")

		# 🚨 IND-34l degree 2: announced, and cannot follow through. no label, no colour
		# ... degree is readable from behaviour or it is not readable at all.
		if warden and th3.degree == 2:
			th3.wind = 0.0
			th3.striking = false
			if th3.pos.distance_to(player_pos) > 780.0 and t > th3.rearm_at:
				th3.announced = false
				th3.rearm_at = t + 8.0
			continue

		# IND-34l degree 3: it walks a perimeter around ground that no longer contains
		# anything. precisely. on schedule. it will never notice you.
		if warden and th3.degree == 3:
			th3.wind = 0.0
			th3.striking = false
			var orb: Vector2 = th3.pos - th3.home
			if orb.length() < 8.0:
				th3.heading = th3.heading.rotated(PI / 2.0)   # the corner: turn, keep walking
			th3.pos += th3.heading * 0.42 * 60.0 * dt
			if orb.length() > Tuning.WARDEN_PERIMETER_R:
				th3.pos = th3.home + orb.normalized() * Tuning.WARDEN_PERIMETER_R
				th3.heading = th3.heading.rotated(PI / 2.0)
			continue

		# IND-34l degree 4: inverted targeting. it engages only what has already
		# stopped. you will find it methodically destroying something that was
		# destroyed years ago, and it will not stop, and it will not notice you.
		if warden and th3.degree == 4:
			var corpse = null
			for th4 in threats:
				if th4 != th3 and not th4.alive and th4.pos.distance_to(th3.pos) < 500.0:
					corpse = th4
					break
			if corpse != null:
				th3.pos += (corpse.pos - th3.pos).normalized() * 0.3 * 60.0 * dt
				th3.wind = minf(1.0, th3.wind + dt)
				if th3.wind > 1.5:
					th3.wind = 0.0
					fx("hit", corpse.pos)
			else:
				# nothing stopped nearby: it stands, waiting for something to be dead
				th3.wind = 0.0
				th3.striking = false
			continue

		# a warden's only surviving instruction is ENGAGE HOSTILES, with no definition
		# of hostile left. runners ignore the handler ... it has to be good company,
		# not an escort mission.
		var tgt := player_pos
		var tgt_kind := "player"
		if mind != null and th3.pos.distance_to(companion_pos) < th3.pos.distance_to(tgt):
			tgt = companion_pos
			tgt_kind = "companion"
		if warden and handler != null and handler.alive and th3.pos.distance_to(handler.pos) < th3.pos.distance_to(tgt):
			tgt = handler.pos
			tgt_kind = "handler"
		var d3: float = th3.pos.distance_to(tgt)

		# ⚠ IND-34i: task-runners in a dust storm cannot see you either. weather is
		# COVER as often as it is a threat.
		var blind := dust_at(th3.pos)
		if blind > 0.15 and d3 > 210.0 * (1.0 - blind * 0.7):
			th3.wind = maxf(0.0, th3.wind - dt * 2.0)
			th3.striking = false
			th3.pos += Vector2(cos(th3.seed_v + t * 0.4), sin(th3.seed_v + t * 0.4)) * th3.speed * 0.5 * 60.0 * dt
			continue

		# IND-34n: the caster keeps its distance and shoots, so the fight has a second
		# verb. a field of pure melee can only ever be walked away from.
		if th3.kind == "caster":
			var HOLD := 300.0
			th3.fire_cd = maxf(0.0, th3.fire_cd - dt)
			if d3 > HOLD + 30.0:
				th3.pos += (tgt - th3.pos) / d3 * th3.speed * 60.0 * dt
			elif d3 < HOLD - 60.0:
				th3.pos -= (tgt - th3.pos) / d3 * th3.speed * 60.0 * dt
			if d3 < HOLD + 90.0:
				th3.wind = minf(1.0, th3.wind + dt * 1.5)
			else:
				th3.wind = maxf(0.0, th3.wind - dt * 2.0)
			if th3.wind >= 1.0 and th3.fire_cd <= 0.0:
				th3.wind = 0.0
				th3.fire_cd = 1.9 + randf() * 0.9
				var ca: float = (tgt - th3.pos).angle()
				var cb := Bullet.new()
				cb.pos = th3.pos
				# ⚠ SLOW. a shot you cannot sidestep is unavoidable damage in a costume.
				cb.vel = Vector2(cos(ca), sin(ca)) * 168.0
				cb.life = 2.6
				cb.from = "threat"
				bullets.append(cb)
				cue("fire")
			continue

		# ── the bestiary. each one a different surviving instruction (IND-34b). ──
		if th3.kind == "loop":
			# stuck repeating a fragment of an action. a new heading every so often,
			# contact damage, and it BURNS OUT ... life runs down and it stops.
			th3.life -= dt
			if th3.life <= 0.0:
				th3.alive = false
				fx("destroy", th3.pos, { "r": 6.0, "warden": false })
				cue("destroy")
				continue
			if t > th3.turn_at:
				th3.turn_at = t + Tuning.LOOP_TURN * (0.5 + randf())
				th3.heading = th3.heading.rotated((randf() - 0.5) * 2.6)
			th3.pos += th3.heading * th3.speed * 60.0 * dt
			th3.pos = th3.pos.clamp(Vector2(10, 10), Vector2(Tuning.W - 10, Tuning.H - 10))
			if th3.pos.distance_to(player_pos) < th3.r + player_r:
				hurt_player(Tuning.LOOP_DMG, 50)
			continue

		if th3.kind == "scav":
			# other assemblers. it stalks, it closes when you are busy or hurt, and
			# it takes ... not damage. a fragment. and then it runs it.
			var want_steal: bool = mind != null
			if want_steal:
				# the floor: only a recently-filled socket is exposed
				var newest := -1
				var newest_at := -INF
				for i in mind.installed.size():
					var f2 = mind.installed[i]
					if f2 != null and f2.install_t >= 0.0 and t - f2.install_t < Tuning.SCAV_WINDOW:
						if f2.install_t > newest_at:
							newest_at = f2.install_t
							newest = i
				if newest < 0:
					want_steal = false
				elif th3.stolen == null:
					# approach the PLAYER (the companion is near them), flee with it otherwise
					var to_p: Vector2 = player_pos - th3.pos
					var dd := to_p.length()
					if dd > Tuning.SCAV_STEAL_REACH:
						th3.pos += to_p / dd * th3.speed * 60.0 * dt
					else:
						# the take. the socket is emptied, the mind recomputes, and the
						# scavenger visibly carries what it stole.
						var taken: Fragments.Frag = mind.installed[newest]
						mind.installed[newest] = null
						mind.recompute()
						th3.stolen = taken
						th3.speed = Tuning.SCAV_FLEE_SPEED
						log_line("it took %s." % taken.name)
						cue("hurt")
						fx("playerhurt", player_pos)
						continue
				else:
					# flee with the prize, toward the nearest edge
					var flee: Vector2 = th3.pos
					if th3.pos.x < Tuning.W / 2.0:
						flee = Vector2(-40.0, th3.pos.y)
					else:
						flee = Vector2(Tuning.W + 40.0, th3.pos.y)
					var away: Vector2 = (flee - th3.pos).normalized()
					th3.pos += away * th3.speed * 60.0 * dt
					if th3.pos.x < -30.0 or th3.pos.x > Tuning.W + 30.0:
						# it is gone, and it took the piece. the record stands.
						th3.alive = false
						continue
			else:
				# no exposed socket: it fights like a cautious runner
				var to_p2: Vector2 = player_pos - th3.pos
				var dd2 := to_p2.length()
				if dd2 > 60.0:
					th3.pos += to_p2 / dd2 * th3.speed * 60.0 * dt
				else:
					th3.wind += dt
					th3.striking = th3.wind > 0.6
					if th3.striking and th3.wind > 1.0:
						th3.wind = 0.0
						if th3.pos.distance_to(player_pos) < 64.0:
							hurt_player(8.0, 60)
			continue

		if th3.kind == "herder":
			# it moves in patterns around nothing, and every so often it tries to move
			# YOU. not an attack ... a nudge at herd speed that relocates your feet.
			th3.pos += th3.heading * th3.speed * 60.0 * dt
			if th3.heading == Vector2.ZERO or t > th3.turn_at:
				th3.turn_at = t + 3.0 + randf() * 3.0
				th3.heading = Vector2.RIGHT.rotated(randf() * TAU)
			if t > th3.pulse_at:
				th3.pulse_at = t + Tuning.HERDER_PULSE_EVERY
				if th3.pos.distance_to(player_pos) < Tuning.HERDER_RANGE:
					var push_dir: Vector2 = (player_pos - th3.pos).normalized()
					player_pos += push_dir * Tuning.HERDER_PUSH * 0.16
					player_prev = player_pos
					cue("hurt")
					fx("hit", player_pos)
			continue

		if th3.kind == "pest":
			# everything is pest. small, fast, many, and they swarm.
			var to_p3: Vector2 = player_pos - th3.pos
			var dd3 := to_p3.length()
			if dd3 > 2.0:
				th3.pos += to_p3 / dd3 * th3.speed * 60.0 * dt
			if dd3 < th3.r + player_r + 2.0 and t > th3.pulse_at:
				th3.pulse_at = t + 0.8
				hurt_player(Tuning.PEST_DMG, 40)
			continue

		if th3.kind == "dray":
			# it walks its line. hazards by mass, not malice: contact hurts and SHOVES.
			th3.pos.x += th3.speed * 60.0 * dt
			if th3.pos.x > Tuning.W + 80.0:
				th3.alive = false
				continue
			if th3.pos.distance_to(player_pos) < th3.r + player_r:
				hurt_player(Tuning.DRAY_DMG, 80)
				var shove: Vector2 = (player_pos - th3.pos).normalized() * Tuning.DRAY_KNOCK * 0.2
				player_pos += shove
				player_prev = player_pos
			continue

		var reach := 92.0 if warden else 56.0
		if d3 < reach:
			th3.wind += dt
			th3.striking = th3.wind > (0.85 if warden else 0.55)
		else:
			th3.wind = maxf(0.0, th3.wind - dt * 2.0)
			th3.striking = false
			th3.pos += (tgt - th3.pos) / d3 * th3.speed * 60.0 * dt
		if th3.striking and th3.wind > (1.5 if warden else 0.95):
			th3.wind = 0.0
			var hit_r := 96.0 if warden else 58.0
			if th3.pos.distance_to(tgt) < hit_r:
				# ⚠ the warden keeps its teeth. the fix is a gentler OPENING, never a
				# nerfed exception.
				var dmg := Tuning.WARDEN_DMG if warden else Tuning.runner_damage(Tuning.depth_at(player_pos.x))
				if tgt_kind == "player":
					hurt_player(dmg, 120 if warden else 70)
				elif tgt_kind == "handler":
					kill_handler()
				elif mind != null:
					companion_hp -= 34.0 if warden else dmg
					cue("hurt")

		# 🚨 the permanent rule, enforced regardless of what it was aiming at.
		if warden and handler != null and handler.alive and th3.pos.distance_to(handler.pos) < Tuning.WARDEN_ONESHOT_RADIUS:
			kill_handler()

		# ⚠ death is handled at hurt_threat, the single damage door. no check here.

	threats = threats.filter(func(th4): return th4.alive or th4.pos.distance_to(player_pos) < 900.0)

	# ⚠ IND-34n: the CROWD is what kills, and a crowd is not a pattern.
	spawn_timer -= dt
	var depth := Tuning.depth_at(player_pos.x)
	var cap2 := roundi(3.0 + depth * 3.0)
	var hostile_n := 0
	for th5 in threats:
		if th5.alive and th5.kind != "stopped":
			hostile_n += 1
	if spawn_timer <= 0.0 and hostile_n < cap2:
		spawn_threat()
		spawn_timer = (4.4 - depth * 1.4) + randf() * 3.0

	# ── the player picks up what they walk over; nearby salvage drifts to them.
	# ⚠ magnetism is a FEEL decision: the walk-over radius stays honest (18px), and
	# only things you have nearly reached slide the last stretch. it removes
	# pixel-hunting, never proximity itself.
	for i2 in range(salvage.size() - 1, -1, -1):
		var s2: SalvageItem = salvage[i2]
		var d_pick := s2.pos.distance_to(player_pos)
		if d_pick < 74.0:
			s2.pos += (player_pos - s2.pos) * minf(1.0, dt * (10.0 if d_pick < 40.0 else 4.5))
		if s2.pos.distance_to(player_pos) < 18.0:
			if s2.frag != "":
				var f := Fragments.make(s2.frag, s2.worn)
				pack.append(f)
				log_line("recovered: %s" % f.name)
			salvage.remove_at(i2)
			cue("pickup")

	if has_chassis and not chassis_taken and chassis_pos.distance_to(player_pos) < 26.0:
		take_chassis()

	# IND-34c: going back for it. no prompt, no marker ... you walk there and it is there.
	if waiting_mind != null and waiting_pos.distance_to(player_pos) < 24.0:
		retrieve()

	deepest = maxf(deepest, player_pos.x)

	# ── IND-34k, the beat. two permanent rules, introduced once. ──
	if not handler_met and chassis_taken and t > Tuning.HANDLER_ARRIVES:
		spawn_handler()
	if handler != null and handler.alive:
		act_handler(dt)
	# 🚨 going deep is not sufficient. the dog has to have BEEN there (HANDLER_GRACE ...
	# the one number a playtest owns, not a measurement).
	if not warden_spawned and handler != null and handler.alive and player_pos.x > Tuning.DEEP_X \
			and t - handler_met_at > Tuning.HANDLER_GRACE:
		spawn_warden()

	do_mend(dt, mend_held)

	# ── IND-34i: the weather crosses. it arrives and it leaves ... never a wall. ──
	if weather != null:
		weather.age += dt
		weather.pos += weather.vel * dt
		weather.strength = minf(1.0, minf(weather.age / 9.0, (weather.life - weather.age) / 12.0))
		if weather.age > weather.life or weather.pos.x < -700.0 or weather.pos.x > Tuning.W + 700.0:
			weather = null
			weather_timer = 70.0 + randf() * 60.0
			log_line("the air clears.")
	else:
		weather_timer -= dt
		if weather_timer <= 0.0:
			spawn_weather()

	# ── the companion ──
	if mind != null:
		mind.decide(self, dt)
		act_companion(dt)
		# 🚨 THE GATE'S OTHER HALF: a player cannot react to something they never notice.
		# it speaks ONCE crossing into real trouble, and not again until made whole.
		var frac := companion_hp / companion_max_hp
		if frac < Tuning.HURT_THRESHOLD and not mind.hurt_announced:
			mind.hurt_announced = true
			log_line("%s is hurt." % companion_name())
		if frac > Tuning.HURT_RESET:
			mind.hurt_announced = false
		if companion_hp <= 0.0:
			companion_hp = 1.0
			mind.hurt_announced = true
			log_line("%s is badly damaged." % companion_name())
		# ⚠ you earn it back: ~3 minutes of ordinary company, near it, not fleeing.
		if mind.bond < 1.0:
			var calm: bool = mind.behaviour != CompanionMind.B.FLEE and companion_pos.distance_to(player_pos) < 120.0
			if calm:
				var before: float = mind.bond
				mind.bond = minf(1.0, mind.bond + dt * Tuning.BOND_RECOVER)
				if before < 1.0 and mind.bond >= 1.0:
					log_line("%s stays close again." % companion_name())
				mind.recompute()

	if player_hp <= 0.0:
		die()

	# ── THE STORYLINE TICK. every piece mechanical, none of it explained. ──
	_story(dt)


## the storyline. IND-34f's register: they say what their function says, nothing
## else, and none of them know. the player's inference is the whole delivery.
func _story(dt: float) -> void:
	# the one beside you (34q). it says its word, at intervals, forever. ⚠ the
	# interval is long: a stuck record, not a companion.
	dormant_next -= dt
	if dormant_next <= 0.0:
		dormant_next = Tuning.DORMANT_EVERY
		if player_pos.distance_to(dormant_pos) < 260.0:
			# it only speaks when someone is near enough to hear. it has been saying
			# it the whole time either way.
			log_line("... return.")

	# the repair unit (34f). free, full, forever. it does not address you.
	if mind != null and companion_hp < companion_max_hp \
			and player_pos.distance_to(repair_pos) < Tuning.REPAIR_RANGE:
		repair_next -= dt
		if repair_next <= 0.0:
			repair_next = 0.5
			companion_hp = minf(companion_max_hp, companion_hp + Tuning.REPAIR_RATE)
			cue("repair")
			fx("hit", companion_pos)
			if companion_hp >= companion_max_hp and randf() < 0.2:
				log_line("COMPLETE. RETURN IF SYMPTOMS PERSIST.")

	# the foreman (34f). standing work: clear the sector, report. the order is a
	# physical thing you are carrying; there is no journal. ⚠ standing work is
	# REPEATABLE ... it will offer it again, forever, because that is its job.
	if not work_order and player_pos.distance_to(foreman_pos) < 60.0:
		work_order = true
		work_handed_in = false
		work_done = 0
		log_line("FOREMAN 12: INTAKE 7 OBSTRUCTED. CLEAR AND REPORT.")
	if work_order and not work_handed_in:
		# "clearing" is killing hostiles in the deep half of the field
		if player_pos.x > Tuning.DEEP_X:
			work_done += 1 if randf() < 0.02 else 0
		if player_pos.distance_to(foreman_pos) < 60.0 and work_done >= Tuning.WORK_ORDER_NEED:
			work_handed_in = true
			manifest_done += 1
			work_order = false
			work_done = 0
			log_line("... LOGGED. SHIFT ENDS AT SIXTEEN HUNDRED.")
			# the reward is what 34f says: the machine now knows a thing, and the
			# fragments from a completed instruction are the best outside The Still
			var sv := SalvageItem.new()
			sv.pos = foreman_pos + Vector2(30, 0)
			sv.frag = "ward"
			sv.worn = 0.6
			salvage.append(sv)
	# 🚨 the final instruction (34f): finish the manifest and it stops. not
	# dramatically. it logs, and powers down, and does not start again.
	if not foreman_finished and manifest_done >= Tuning.FOREMAN_MANIFEST:
		foreman_finished = true
		log_line("FOREMAN 12: MANIFEST COMPLETE.")
		fx("heartdrop", foreman_pos)
		cue("destroy")
		for i in 2:
			var sv2 := SalvageItem.new()
			sv2.pos = foreman_pos + Vector2((randf() - 0.5) * 40.0, (randf() - 0.5) * 40.0)
			sv2.frag = ["attend", "repair", "mark"][i]
			sv2.worn = 1.0     # whole. undamaged. not torn out of anything still running.
			salvage.append(sv2)

	# the commissary (34f). walk in with salvage; it invents its own exchange rate.
	if player_pos.distance_to(commissary_pos) < 50.0 and pack.size() > 0:
		var f3 = pack.pop_back()
		scrip += 1
		log_line("COMMISSARY 4: ... ACCEPTED. THANK YOU FOR YOUR SERVICE.")
		cue("pickup")
		# what scrip buys: it has what it has. a ration bar is a repair, once.
		if scrip % 2 == 0:
			player_hp = minf(Tuning.PLAYER_HP, player_hp + 25.0)

	# the still (34b): walk among the rows. the fragments are whole. taking one is
	# the moral centre of the world, and the game never says one word about it.
	still_found = still_found or player_pos.distance_to(still_at) < 420.0
	for st in still_rows:
		if st.taken:
			continue
		if player_pos.distance_to(st.pos) < 24.0:
			st.taken = true
			var sv3 := SalvageItem.new()
			sv3.pos = st.pos
			sv3.frag = Fragments.ROLLABLE[randi() % Fragments.ROLLABLE.size()]
			sv3.worn = 1.0     # 🚨 whole. they were not torn out of anything.
			salvage.append(sv3)
			cue("pickup")
			# ⚠ no comment. no morality. the record is what you are made of (34d).

	# 🚨 THE DOOR (34r). passable when the build is real. it never asks, never
	# marks, never counts. walking in is the only ending where it keeps running.
	if mind != null and mind.live_fragments().size() >= Tuning.DOOR_FRAGS \
			and player_pos.distance_to(door_pos) < 40.0:
		ascended = true
		log_line("I'll be here when you return.")
		cue("stand")
		fx("recall", door_pos)

	# the handler by degree 2 (34l): it will not leave. it is waiting for someone.
	# found, never signposted, in the far corner nobody visits. you can strip it;
	# it will not resist; it will still be facing the door.
	waiting_dog_found = waiting_dog_found or player_pos.distance_to(waiting_dog_pos) < 380.0
	if not waiting_dog_taken and player_pos.distance_to(waiting_dog_pos) < 22.0:
		waiting_dog_taken = true
		# it does not resist. the heart it carried is worn to the bone: somebody's.
		var sv4 := SalvageItem.new()
		sv4.pos = waiting_dog_pos
		sv4.frag = "heart"
		sv4.worn = 1.0
		salvage.append(sv4)
		cue("pickup")
		# ⚠ no comment. it is still facing the door. the game never says whose dog
		# this was, or whose door. the record is what you are made of.

	# what is buried (34i §2). 🚨 the companion finds it, not you: it has to be
	# standing over the spot, curious enough to care, and you have to give it the
	# seconds. a dull machine walks past everything buried and never mentions it.
	if mind != null and mind.curiosity >= Tuning.BURIED_CURIOSITY:
		for b in buried:
			if b.done:
				continue
			if companion_pos.distance_to(b.pos) < 30.0 and player_pos.distance_to(b.pos) < 90.0 \
					and mind.behaviour != CompanionMind.B.FLEE:
				b.dig += dt
				if b.dig >= Tuning.BURIED_DIG:
					b.done = true
					var sv5 := SalvageItem.new()
					sv5.pos = b.pos
					sv5.frag = b.frag
					sv5.worn = 1.0     # buried things predate the Scatter: WHOLE
					salvage.append(sv5)
					cue("pickup")
					log_line("it dug something up.")
			else:
				b.dig = maxf(0.0, b.dig - dt * 2.0)
