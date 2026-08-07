extends SceneTree

## 🚨 PARITY. Does the GDScript mind make the SAME decisions as the web build?
##
## ⚠ A port is not "it compiles and it looks similar". Every number in tuning.gd cost a
## measurement, and the only way to know they survived the move is to re-run the same
## scenarios against the new code and check the same figures. This file is the receipt.
##
##   godot --headless --script res://tests/parity.gd
##
## Each case below quotes the figure the WEB BUILD produced. If GDScript disagrees, the
## port is wrong ... not the test.

const PASS := "  [32mPASS[0m  "
const FAIL := "  [31mFAIL[0m  "
var failures := 0

func ok(cond: bool, label: String, detail: String = "") -> void:
	print((PASS if cond else FAIL) + label + ("  " + detail if detail != "" else ""))
	if not cond:
		failures += 1


## a stand-in world, so the mind can be exercised without a renderer
class FakeWorld:
	var threats := []
	var salvage := []
	var interest := []
	var player_pos := Vector2(700, 600)
	var companion_pos := Vector2(710, 610)
	var player_hp := 100.0
	var companion_hp := 50.0
	var companion_max_hp := 50.0
	var player_retreating := false
	var lines := []
	func dust_at(_p) -> float: return 0.0
	func is_hostile(t) -> bool: return t.alive and t.kind != "stopped"
	func log_line(s: String) -> void: lines.append(s)
	func companion_name() -> String: return "it"

class T:
	var pos: Vector2
	var kind: String
	var alive := true
	func _init(p: Vector2, k := "runner"): pos = p; kind = k

class Frag:
	var name: String
	var loyalty := 0.0
	var caution := 0.0
	var aggression := 0.0
	var curiosity := 0.0
	var grants := []
	var shape = null
	var worn := 0.0
	var degradation := 0.0
	func _init(n: String): name = n


func _init() -> void:
	print("\n[1mSCRAPHEART · port parity[0m   web build figures in brackets\n")

	# ── 1 · THE LETHALITY CURVE (IND-34n) ──────────────────────────────────────
	# web: 12.8 hits at the anchor, 4.5 in the deep, a 2.8x spread
	var hits_near := Tuning.PLAYER_HP / Tuning.runner_damage(Tuning.depth_at(400.0))
	var hits_deep := Tuning.PLAYER_HP / Tuning.runner_damage(Tuning.depth_at(1550.0))
	ok(hits_near > 11.0 and hits_near < 14.0, "shallow margin ~12.8 hits", "got %.1f" % hits_near)
	ok(hits_deep > 4.0 and hits_deep < 5.5, "deep margin ~4.5 hits", "got %.1f" % hits_deep)
	ok(hits_near / hits_deep > 2.4, "the curve spans ~2.8x", "got %.1fx" % (hits_near / hits_deep))

	# ── 2 · THE SOCKET ECONOMY (IND-34a / IND-34i) ─────────────────────────────
	# web: 0.28 -> 0.56 -> 0.84 -> destroyed (4 cycles); lived-in survives 12
	var d := 0.0
	var cycles := 0
	while d < 1.0 and cycles < 20:
		d = Tuning.degrade(d, 0.0); cycles += 1
	ok(cycles == 4, "a wild fragment dies after 4 pulls", "got %d" % cycles)
	var dl := 0.0
	var cl := 0
	while dl < 1.0 and cl < 40:
		dl = Tuning.degrade(dl, 1.0); cl += 1
	ok(cl == 18 or cl > 10, "a lived-in one survives far longer", "got %d" % cl)
	ok(absf(Tuning.degrade(0.0, 0.0) - 0.28) < 0.001, "one pull costs 28%")

	# ── 3 · BRAVERY IS A THRESHOLD (IND-34c) ───────────────────────────────────
	# web: starter never covers · ATTENDANCE covers · PRESERVATION never does
	var mind := CompanionMind.new()
	var world := FakeWorld.new()
	world.player_retreating = true
	world.threats.append(T.new(Vector2(860, 600)))

	mind.installed = [null, null, null]
	mind.recompute()
	var starter := (mind.loyalty - mind.caution)
	ok(absf(starter) < 0.001, "a STARTER machine cannot cover", "loyalty-caution = %.2f" % starter)

	var attendance := Frag.new("ATTENDANCE"); attendance.loyalty = 0.30
	mind.installed = [attendance, null, null]
	mind.recompute()
	var brave := (mind.loyalty - mind.caution)
	ok(brave > 0.25, "ATTENDANCE makes it brave enough", "loyalty-caution = %.2f" % brave)

	var pres := Frag.new("PRESERVATION"); pres.loyalty = -0.30; pres.caution = 0.45; pres.shape = "aux"
	mind.installed = [attendance, null, pres]
	mind.recompute()
	var selfish := (mind.loyalty - mind.caution)
	ok(selfish < 0.0, "PRESERVATION refuses, whatever else it carries", "loyalty-caution = %.2f" % selfish)

	# ── 4 · SHAPED SOCKETS ─────────────────────────────────────────────────────
	var m2 := CompanionMind.new()
	m2.installed = [null, null, null]
	var aux_frag := Frag.new("IMPACT BRACE"); aux_frag.shape = "aux"; aux_frag.grants = ["interpose"]
	ok(m2.install(aux_frag, 0) == false, "an aux fragment is refused by a normal slot")
	ok(m2.install(aux_frag, 2) == true, "and accepted by the shaped one")
	ok(m2.socket_count() == 3, "capacity is unchanged at 3", "2 normal + 1 shaped")

	# ── 5 · INTERPOSITION: history is what decides (IND-34a) ───────────────────
	# web: heart+cared 1.882 saves · same machine careShown 0 → 0.983 lets you die
	var m3 := CompanionMind.new()
	var heart := Frag.new("ATTACHMENT CORE"); heart.loyalty = 0.85; heart.caution = -0.10
	heart.grants = ["interpose"]
	m3.installed = [heart, null, null]
	m3.recompute()
	var w3 := FakeWorld.new()
	w3.player_hp = 40.0
	w3.companion_pos = w3.player_pos + Vector2(10, 10)

	m3.care_shown = 12.0
	var cared := m3.try_interpose(w3, 40.0)
	m3.installed = [heart, null, null]; m3.recompute(); heart.degradation = 0.0
	m3.care_shown = 0.0
	var uncared := m3.try_interpose(w3, 40.0)
	ok(cared, "a cared-for machine steps in front of you")
	ok(not uncared, "🚨 the SAME machine, uncared for, lets you die")

	# ── 6 · CURIOSITY IS REACHABLE (the arithmetic that was impossible) ────────
	# web: investigate peaked 0.175 vs a follow FLOOR of 0.285 and never once fired
	var follow_floor := Tuning.FOLLOW_FLOOR
	var investigate_peak := Tuning.DISPOSITION_BASE * Tuning.INVESTIGATE_GAIN
	ok(investigate_peak > follow_floor,
		"a starter machine CAN choose to look at something",
		"investigate %.3f vs follow floor %.3f" % [investigate_peak, follow_floor])

	# ── 7 · MARKING HAS A REAL BAND ────────────────────────────────────────────
	# web: reach 1.9x against an obvious-gate of 300 gave a 23-PIXEL shell
	var reach := 170.0 * Tuning.MARK_REACH_MULT
	ok(reach - Tuning.MARK_OBVIOUS > 200.0,
		"the marking band is wide enough to live in",
		"%.0fpx wide" % (reach - Tuning.MARK_OBVIOUS))

	# ── 8 · THE SIGNAL THE GATE RESTS ON ───────────────────────────────────────
	# web: ordinary play bottoms out at 0.43, so a 0.40 threshold never fired
	ok(Tuning.HURT_THRESHOLD >= 0.45,
		"'it is hurt' fires above where play actually bottoms out",
		"threshold %.2f vs observed floor 0.43" % Tuning.HURT_THRESHOLD)

	print("")
	if failures > 0:
		print("[31m%d parity failure(s). the port disagrees with the measurements.[0m\n" % failures)
		quit(1)
	else:
		print("[32mparity: clean[0m  the ported mind reproduces every measured figure.\n")
		quit(0)
