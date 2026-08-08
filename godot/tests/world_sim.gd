extends SceneTree

## THE WORLD SIM ... headless receipts for the ported GameWorld, the same discipline as
## tests/parity.gd: every claim a number, run it or it is a wish.
##
##   godot --headless --path godot --script res://tests/world_sim.gd
##
## parity.gd proves the MIND reproduces the web build's figures; this proves the WORLD
## does: the opening stands a companion, heat locks where it locked, the recall banks,
## permadeath takes everything and spares the machine, and nothing is immortal.

var fails := 0


func check(name: String, ok: bool, detail := "") -> void:
	print("  %s  %s%s" % ["PASS" if ok else "FAIL", name, ("  " + detail) if detail != "" else ""])
	if not ok:
		fails += 1


func _init() -> void:
	var dt := 1.0 / 60.0

	# ── 1 · the opening stands a machine ──
	var w := GameWorld.new()
	w.player_pos = w.chassis_pos + Vector2(10, 0)
	w.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the chassis becomes a companion", w.mind != null and w.chassis_taken)
	check("it can move, and that is all", w.mind != null and w.mind.live_fragments().size() == 1
		and w.mind.live_fragments()[0].id == "gait")

	# ── 2 · heat is a rhythm: lock lands where the web build measured it (1.97s) ──
	var lock_at := -1.0
	var aim: Vector2 = w.player_pos + Vector2(100, 0)
	for i in 300:
		w.tick(dt, Vector2.ZERO, true, aim)
		if w.overheated > 0.0 and lock_at < 0.0:
			lock_at = (i + 1) * dt
			break
	check("sustained fire locks the driver", lock_at > 0.0, "at %.2fs" % lock_at)
	check("the lock lands near the measured 1.97s", lock_at > 1.6 and lock_at < 2.4)
	var lock_dur := 0.0
	while w.overheated > 0.0 and lock_dur < 5.0:
		w.tick(dt, Vector2.ZERO, true, aim)   # still holding: a lock you can hold through
		lock_dur += dt
	check("the lock lasts the designed 2s", lock_dur > 1.7 and lock_dur < 2.4, "%.2fs" % lock_dur)

	# ── 3 · the immortal-machine class stays dead, in this engine too ──
	var bw = null
	for th in w.threats:
		if th.kind == "warden" and th.degree == 2:
			bw = th
			break
	check("the broken warden exists", bw != null)
	if bw != null:
		var rounds := 0
		var strand := false
		while bw.alive and rounds < 100:
			w.hurt_threat(bw, 12.0)
			rounds += 1
			if bw.alive and bw.hp <= 0.0:
				strand = true
		check("no alive machine at hp <= 0", not strand)
		check("the broken warden CAN die", not bw.alive, "after %d hits" % rounds)
		var selfpres := false
		for s in w.salvage:
			if s.frag == "selfpres":
				selfpres = true
		check("and drops what a warden drops", selfpres)

	# ── 4 · the recall banks; that is the entire point of the button ──
	w.pack.append(Fragments.make("ward"))
	w.pack.append(Fragments.make("inquiry"))
	w.player_pos = Vector2(1400, 600)
	w.tick(dt, Vector2.ZERO, false, Vector2.ZERO, true)
	check("the recall is instant", w.player_pos.distance_to(w.anchor) < 1.0)
	check("carried became kept", w.banked.size() == 2 and w.pack.size() == 0)

	# ── 5 · permadeath: gear gone (banked TOO), machine spared, retrieval is not free ──
	var name_before := "verse"
	w.comp_name = name_before
	w.named = true
	var frags_before: int = w.mind.live_fragments().size()
	w.hurt_player(9999.0, 0)
	w.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("you die here", w.run == 2)
	check("banked is not safe from dying", w.banked.size() == 0 and w.pack.size() == 0)
	check("the companion does NOT die", w.waiting_mind != null and w.mind == null)
	check("fame recorded", w.records.size() == 1 and int(w.records[0].kept) == 2)
	# going back for it
	w.player_pos = w.waiting_pos + Vector2(5, 0)
	w.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("it is still standing where you fell", w.mind != null and w.waiting_mind == null)
	check("the name survives", w.comp_name == name_before)
	check("it does not simply resume", w.mind != null and absf(w.mind.bond - Tuning.BOND_ON_RETRIEVE) < 0.01)
	check("everything you built survived", w.mind != null and w.mind.live_fragments().size() == frags_before)

	# ── 6 · the damage door: a full minute of open combat, invariant sampled every tick ──
	var w2 := GameWorld.new()
	w2.player_pos = Vector2(1200, 600)   # deep enough for casters to exist
	var violations := 0
	var aim2 := Vector2(1300, 600)
	for i in 3600:
		w2.tick(dt, Vector2(0.3, 0.0) if i % 120 < 60 else Vector2(-0.3, 0.0), true, aim2)
		for th in w2.threats:
			if th.alive and th.hp <= 0.0:
				violations += 1
		if w2.run > 1:
			break   # dying in the deep is the calibration working, not a failure
	check("a minute of combat, zero dead-but-alive machines", violations == 0, "%d violations" % violations)

	print("")
	if fails == 0:
		print("world sim: clean  the ported world holds every claim.")
	else:
		print("world sim: %d FAILED" % fails)
	quit(1 if fails > 0 else 0)
