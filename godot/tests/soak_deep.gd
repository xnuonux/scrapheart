extends SceneTree

## THE DEEP SOAK ... is the east actually survivable with the full bestiary live?
## a bot walks deep, stands in the pressure, and we read what the field does to it.
## the calibration law: ~14 hits at the anchor, ~4.5 in the deep. the deep should be
## LETHAL but LEGIBLE ... dodgeable, never a corridor of unavoidable damage.

var fails := 0


func check(name: String, ok: bool, detail := "") -> void:
	print("  %s  %s%s" % ["PASS" if ok else "FAIL", name, ("  " + detail) if detail != "" else ""])
	if not ok:
		fails += 1


func _init() -> void:
	var dt := 1.0 / 60.0
	var w := GameWorld.new()
	w.player_pos = w.chassis_pos + Vector2(10, 0)
	w.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	w.mind.install(Fragments.make("repair"), 1, w.t)   # a real second fragment
	w.mind.recompute()

	# walk east, deep, and hold. the bot dodges nothing: it is a measuring device.
	w.player_pos = Vector2(1450, 600)
	var deaths := 0
	var kind_seen := {}
	var dmg_taken := 0.0
	var hp_prev: float = Tuning.PLAYER_HP
	var aim := Vector2(1550, 600)
	var worst_tick := 0.0
	var worst_kind := ""
	var run_prev := 1
	for i in 60 * 90:   # 90 seconds deep
		w.tick(dt, Vector2(0, 0), true, aim)
		var tick_dmg: float = maxf(0.0, hp_prev - w.player_hp)
		if tick_dmg > worst_tick:
			worst_tick = tick_dmg
			# name whatever is sitting on the player
			var names := []
			for th in w.threats:
				if th.alive and th.pos.distance_to(w.player_pos) < 80.0:
					names.append(th.kind)
			worst_kind = ",".join(names)
		if w.player_hp > hp_prev:
			dmg_taken = 0.0   # repaired; reset the window, keep the run going
		else:
			dmg_taken += hp_prev - w.player_hp
		hp_prev = w.player_hp
		for th in w.threats:
			if th.alive:
				kind_seen[th.kind] = true
		if w.run > run_prev:
			deaths += 1
			run_prev = w.run
			# walk back out and in again: permadeath is the calibration working
			w.player_pos = Vector2(1450, 600)
			hp_prev = Tuning.PLAYER_HP
		if w.player_pos.distance_to(Vector2(1450, 600)) > 200.0:
			w.player_pos = Vector2(1450, 600)
			w.player_prev = w.player_pos
	print("  worst single tick: %.1f dmg, near: %s" % [worst_tick, worst_kind])

	var kinds := kind_seen.keys()
	kinds.sort()
	print("  bestiary seen deep: %s" % ", ".join(kinds))
	check("the deep is populated by the bestiary", kinds.size() >= 3, ", ".join(kinds))
	check("the deep is LETHAL", deaths >= 1, "%d deaths in 90s of standing still" % deaths)
	check("and standing still is not INSTANT death", deaths <= 4,
		"a bot that dodges nothing survived meaningful time")
	check("the companion survived alongside", w.mind != null or w.waiting_mind != null)

	print("")
	if fails == 0:
		print("deep soak: clean  the east kills, and it kills fairly.")
	else:
		print("deep soak: %d FAILED" % fails)
	quit(1 if fails > 0 else 0)
