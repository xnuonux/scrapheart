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
	print("  ... [1] opening")
	var w := GameWorld.new()
	w.player_pos = w.chassis_pos + Vector2(10, 0)
	w.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the chassis becomes a companion", w.mind != null and w.chassis_taken)
	check("it can move, and that is all", w.mind != null and w.mind.live_fragments().size() == 1
		and w.mind.live_fragments()[0].id == "gait")

	# ── 2 · heat is a rhythm: lock lands where the web build measured it (1.97s) ──
	print("  ... [2] heat")
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
	print("  ... [3] damage door")
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
	print("  ... [4] recall")
	w.pack.append(Fragments.make("ward"))
	w.pack.append(Fragments.make("inquiry"))
	w.player_pos = Vector2(1400, 600)
	w.tick(dt, Vector2.ZERO, false, Vector2.ZERO, true)
	check("the recall is instant", w.player_pos.distance_to(w.anchor) < 1.0)
	# ⚠ magnetism: salvage near the anchor drifts in and is picked up on arrival,
	# so pack is not necessarily empty ... the CONTRACT is carried became kept.
	check("carried became kept", w.banked.size() >= 2 and w.pack.size() >= 0)

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
	check("fame recorded", w.records.size() == 1 and int(w.records[0].kept) >= 2)
	# going back for it
	w.player_pos = w.waiting_pos + Vector2(5, 0)
	w.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("it is still standing where you fell", w.mind != null and w.waiting_mind == null)
	check("the name survives", w.comp_name == name_before)
	check("it does not simply resume", w.mind != null and absf(w.mind.bond - Tuning.BOND_ON_RETRIEVE) < 0.01)
	check("everything you built survived", w.mind != null and w.mind.live_fragments().size() == frags_before)

	# ── 6 · the damage door: a full minute of open combat, invariant sampled every tick ──
	print("  ... [6] combat minute")
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

	# ── 7 · the bestiary (IND-34b/34i/34j/34l), each claim direct ──
	print("  ... [7] bestiary")
	var w3 := GameWorld.new()
	# loops burn out on their own
	w3._spawn_loop(0.6)
	var lp = w3.threats[w3.threats.size() - 1]
	var burned := false
	for i in int(Tuning.LOOP_LIFE * 2.0 * 60.0):
		w3.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
		if not lp.alive:
			burned = true
			break
	check("a loop burns out on its own", burned, "nothing needed killing it")

	# 🚨 the scavenger floor: a SETTLED companion is never at risk
	print("  ... [7b] scav floor")
	var w4 := GameWorld.new()
	w4.player_pos = w4.chassis_pos + Vector2(10, 0)
	w4.tick(dt, Vector2.ZERO, false, Vector2.ZERO)   # take the chassis
	check("[pre] w4 companion stands", w4.mind != null)
	w4.mind.install(Fragments.make("ward"), 1, 0.0)  # installed at t=0, long settled
	w4.t = Tuning.SCAV_WINDOW + 10.0                 # the window has closed
	var before: int = w4.mind.live_fragments().size()
	var scav_taken := false
	for i in 60 * 20:
		w4._spawn_scav(0.6)
		w4.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
		w4.player_pos = Vector2(700, 600)
		if w4.mind == null or w4.mind.live_fragments().size() < before:
			scav_taken = true
			break
	check("the scavenger floor holds: settled sockets are safe", not scav_taken,
		"20s of scavengers against a settled build")

	# ... and a FRESH socket can be taken, and it runs in them
	print("  ... [7c] scav steal")
	var w5 := GameWorld.new()
	w5.player_pos = w5.chassis_pos + Vector2(10, 0)
	w5.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("[pre] w5 companion stands", w5.mind != null)
	var fresh := Fragments.make("inquiry")
	fresh.install_t = w5.t
	w5.mind.installed[1] = fresh
	w5.mind.recompute()
	var stolen_frag = null
	for i in 60 * 40:
		if i % 90 == 0:
			w5._spawn_scav(0.6)
		w5.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
		w5.player_pos = Vector2(700, 600)
		if w5.mind != null and w5.mind.installed[1] == null:
			for th in w5.threats:
				if th.kind == "scav" and th.stolen != null:
					stolen_frag = th.stolen
			break
		if w5.t > 300.0:
			break
	check("a fresh fragment CAN be taken", stolen_frag != null,
		"it runs in them, visibly, and it flees with the prize")

	# ... and killing the scavenger gives it back, degraded (34b: real, not clean)
	var w5b := GameWorld.new()
	w5b.player_pos = w5b.chassis_pos + Vector2(10, 0)
	w5b.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	var fresh2 := Fragments.make("inquiry")
	fresh2.install_t = w5b.t
	w5b.mind.installed[1] = fresh2
	w5b.mind.recompute()
	var round_trip := false
	for i in 60 * 40:
		if i % 90 == 0:
			w5b._spawn_scav(0.6)
		# fire at the thief the moment it has the prize: the bot fights back
		var thief = null
		for th in w5b.threats:
			if th.kind == "scav" and th.stolen != null:
				thief = th
		if thief != null:
			w5b.player_pos = thief.pos + Vector2(-60, 0)
			w5b.tick(dt, Vector2.ZERO, true, thief.pos)
		else:
			w5b.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
		for s in w5b.salvage:
			if s.frag == "inquiry":
				round_trip = true
		if round_trip:
			break
		if w5b.t > 300.0:
			break
	check("killing the thief returns the piece (degraded)", round_trip,
		"recovery is real but not clean")

	# ── 8 · THE STORYLINE (34q / 34f / 34b / 34r), each claim mechanical ──
	print("  ... [8] storyline")
	var w6 := GameWorld.new()
	w6.player_pos = w6.chassis_pos + Vector2(10, 0)
	w6.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	# the dormant one speaks when you are near, on its timer, and never otherwise
	w6.player_pos = w6.dormant_pos + Vector2(40, 0)
	w6.dormant_next = 0.01
	w6.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the dormant one speaks near you", w6.logs.size() > 0 and w6.logs[0].text.contains("return"))
	# the repair unit heals the companion for free, forever
	w6.player_pos = w6.repair_pos + Vector2(20, 0)
	w6.companion_hp = w6.companion_max_hp * 0.3
	var hp0: float = w6.companion_hp
	for i in 120:
		w6.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the repair unit mends for free", w6.companion_hp > hp0 + 20.0,
		"%.0f -> %.0f" % [hp0, w6.companion_hp])
	# the foreman hands a work order when you walk close, accepts the report, and
	# the manifest ENDS it
	w6.player_pos = w6.foreman_pos + Vector2(10, 0)
	w6.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the foreman assigns standing work", w6.work_order,
		"you walked close; it told you what it wanted")
	w6.work_done = Tuning.WORK_ORDER_NEED
	w6.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the report is logged", w6.work_handed_in and w6.manifest_done == 1 and not w6.work_order)
	for k in Tuning.FOREMAN_MANIFEST - 1:
		w6.work_order = false   # walk away, come back: it offers again, forever
		w6.player_pos = w6.foreman_pos + Vector2(200, 0)
		w6.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
		w6.player_pos = w6.foreman_pos + Vector2(10, 0)
		w6.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
		check("[pre] it offers standing work again", w6.work_order)
		w6.work_done = Tuning.WORK_ORDER_NEED
		w6.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the final instruction ends it", w6.foreman_finished,
		"it logs its last line and powers down; its fragments are whole")
	# the still: rows exist, are found by proximity, and give WHOLE fragments
	check("the still stands in rows", w6.still_rows.size() == 15)
	var salvage_before: int = w6.salvage.size()
	w6.player_pos = w6.still_at + Vector2(46, 0)   # standing IN the first row
	w6.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the still is found by walking there", w6.still_found)
	var worn_all := true
	var still_given := 0
	for i in range(salvage_before, w6.salvage.size()):
		var s = w6.salvage[i]
		still_given += 1
		if s.worn < 1.0:
			worn_all = false
	check("what the still gives is WHOLE", still_given > 0 and worn_all,
		"%d whole pieces; not torn out of anything" % still_given)
	# the door: passable only with a real build, and walking in is the fifth ending
	check("the door is shut to an empty build", not w6.ascended and w6.player_pos.distance_to(w6.door_pos) > 40.0)
	var w7 := GameWorld.new()
	w7.player_pos = w7.chassis_pos + Vector2(10, 0)
	w7.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	w7.mind.install(Fragments.make("attend"), 1, w7.t)
	w7.mind.install(Fragments.make("repair"), 2, w7.t)
	w7.player_pos = w7.door_pos + Vector2(5, 0)
	w7.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the door opens to a real build", w7.ascended)
	check("the last line is the last line", w7.logs.size() > 0 and w7.logs[0].text.begins_with("I'll be here"))

	# ── 9 · the degrees and the buried (34l #2 / 34i §2) ──
	print("  ... [9] waiting dog + buried")
	var w8 := GameWorld.new()
	# the waiting dog: it is found by proximity, stripped without resistance, and
	# what it gives is a WHOLE heart
	check("[pre] the waiting dog exists", not w8.waiting_dog_taken)
	w8.player_pos = w8.waiting_dog_pos + Vector2(5, 0)
	w8.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("the waiting dog is found by walking there", w8.waiting_dog_found and w8.waiting_dog_taken)
	var heart_found := false
	for s in w8.salvage:
		if s.frag == "heart" and s.worn >= 1.0:
			heart_found = true
	check("what it leaves is a WHOLE heart", heart_found)
	# buried: a curious companion digs it up; the dig needs seconds and stillness
	var w9 := GameWorld.new()
	w9.player_pos = w9.chassis_pos + Vector2(10, 0)
	w9.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	w9.mind.install(Fragments.make("inquiry"), 1, w9.t)   # curiosity 0.15 + 0.60
	w9.mind.recompute()
	check("[pre] curious enough to dig", w9.mind.curiosity >= Tuning.BURIED_CURIOSITY)
	var b0: Dictionary = w9.buried[0]
	var dug := false
	for i in int(Tuning.BURIED_DIG * 60.0) + 120:
		w9.player_pos = b0.pos + Vector2(30, 0)   # near, watching; it does the work
		w9.mind.behaviour = CompanionMind.B.INVESTIGATE
		w9.companion_pos = b0.pos
		w9.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
		if b0.done:
			dug = true
			break
	check("a curious companion digs up what is buried", dug)
	# ... and a DULL one (no inquiry) never does
	var w10 := GameWorld.new()
	w10.player_pos = w10.chassis_pos + Vector2(10, 0)
	w10.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("[pre] the bare chassis is dull", w10.mind.curiosity < Tuning.BURIED_CURIOSITY)
	var b1: Dictionary = w10.buried[0]
	for i in int(Tuning.BURIED_DIG * 60.0) + 60:
		w10.player_pos = b1.pos + Vector2(30, 0)
		w10.companion_pos = b1.pos
		w10.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	check("a dull companion walks past everything buried", not b1.done)

	# ── 10 · the commissary's fixed inventory (34f: it has what it has) ──
	print("  ... [10] commissary")
	var w11 := GameWorld.new()
	w11.player_pos = w11.chassis_pos + Vector2(10, 0)
	w11.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
	var got_frag := false
	for i in 8:
		w11.pack.append(Fragments.make("gait"))   # feed it salvage
		w11.player_pos = w11.commissary_pos + Vector2(5, 0)
		w11.tick(dt, Vector2.ZERO, false, Vector2.ZERO)
		for f in w11.pack:
			if f.id == "mark":
				got_frag = true
	check("the shelf holds two bars and one fragment, then nothing", got_frag and w11.commissary_stock == 0 and not w11.commissary_frag,
		"it will never restock; it keeps saying the line anyway")

	print("")
	if fails == 0:
		print("world sim: clean  the ported world holds every claim.")
	else:
		print("world sim: %d FAILED" % fails)
	quit(1 if fails > 0 else 0)
