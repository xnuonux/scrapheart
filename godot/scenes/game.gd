extends Node2D

## SCRAPHEART ... the game scene. the world simulates in GameWorld (the ported
## reference), this node draws it with the ported renderer, and the HUD layer reads
## both. zero buttons anywhere ... the web build's law, kept.
##
##   godot --path godot res://scenes/game.tscn
##   godot --path godot res://scenes/game.tscn -- --shots     scripted frames + quit

var world: GameWorld
var cam: GameCamera
var vignette: ColorRect
var hud   # hud.gd Control; untyped so the cross-script surface stays duck-typed
var lights: LightRig
var fx_rig: VfxRig
var sfx_rig: SfxRig
var far: Farfield
var touch: TouchLayer

var last_player_hp := 0.0
var _hurt_pulse := 0.0
var _ascension_started := false

var _shots := false
var _frame := 0
var _script_steps: Array = []


func _ready() -> void:
	world = GameWorld.new()
	last_player_hp = world.player_hp
	cam = $Camera
	vignette = $Haze/Vignette
	hud = $HUD/Overlay
	hud.game = self
	lights = $Lights
	fx_rig = $Vfx
	sfx_rig = $Sfx
	far = $Farfield
	touch = $HUD/Touch
	touch.game = self
	cam.position = world.player_pos
	cam.target = world.player_pos

	_shots = OS.get_cmdline_user_args().has("--shots")
	if _shots:
		_script_steps = [
			[50, Vector2.ZERO, "game-01-spawn"],
			[140, Vector2.RIGHT, "game-02-chassis"],
			[160, Vector2(1, -0.3).normalized(), "game-03-east"],
		]


func _physics_process(dt: float) -> void:
	# hitstop: the world freezes, the frame does not. drained in real time.
	if world.hitstop_s > 0.0:
		world.hitstop_s = maxf(0.0, world.hitstop_s - dt)
	else:
		var mv := Vector2(
			Input.get_axis("move_left", "move_right"),
			Input.get_axis("move_up", "move_down"))
		if _shots:
			mv = _drive_script()
		if mv.length() > 1.0:
			mv = mv.normalized()

		var firing: bool = (Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) or touch.firing) \
			and not hud.pack_open
		var aim := touch.aim_world if touch.firing else get_global_mouse_position()
		# the stick merges over the keys, exactly as the web intent layer does
		if touch.stick_active:
			mv = touch.stick_vec
		if mv.length() > 1.0:
			mv = mv.normalized()

		var recalling := Input.is_action_just_pressed("recall")
		var mend_held := Input.is_action_pressed("mend")

		world.tick(dt, mv, firing, aim, recalling, mend_held)

		# trauma rides the damage the world already reports
		if world.player_hp < last_player_hp:
			cam.add_trauma(0.45)
		last_player_hp = world.player_hp

		# positioned vfx drain into the rigs
		for e in world.vfx:
			if e.kind == "muzzle":
				lights.flash_muzzle()
			else:
				fx_rig.spend(e.kind, e.pos)
		world.vfx.clear()
		sfx_rig.drain(world.sounds)

	cam.target = world.player_pos
	far.follow(cam.position)
	lights.frame_update(world, dt)
	fx_rig.follow_camera(cam.position)
	# the ascension: the world goes away for a long moment and stays gone. the
	# screen agrees with the fiction (the same contraction the recall uses, held).
	if world.ascended and not _ascension_started:
		_ascension_started = true
		world.death_flash = 2.2
	var dust := world.dust_at(world.player_pos)
	var mat := vignette.material as ShaderMaterial
	mat.set_shader_parameter("dust", dust)
	mat.set_shader_parameter("depth", Tuning.depth_at(world.player_pos.x))
	# the hurt pulse: a spike that decays over ~0.4s. the world reports WHEN, the
	# haze reports HOW LOUD.
	if world.t - world.last_hurt < 0.12:
		_hurt_pulse = 1.0
	_hurt_pulse = maxf(0.0, _hurt_pulse - dt * 2.6)
	mat.set_shader_parameter("hurt", _hurt_pulse)
	queue_redraw()
	hud.queue_redraw()


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("pack"):
		hud.toggle_pack()
	if event is InputEventKey and event.pressed and event.keycode == KEY_M:
		sfx_rig.muted = not sfx_rig.muted


func _draw() -> void:
	var w := world
	var t := Time.get_ticks_msec() / 1000.0

	# the ground lives in its own node now (the shader floor). this draw starts at the
	# things standing on it ... shadows first, so everything is planted, not floating.
	var view_r := 900.0
	for wk in w.wrecks:
		if wk.pos.distance_to(w.player_pos) > view_r:
			continue
		_shadow(wk.pos, wk.s * 0.9)
		Sprites.wreck(self, wk.pos, wk.s, wk.seed_v, false)

	# things worth nothing. only ever a shape and a light.
	for i in w.interest:
		# ⚠ the heart sits in this list for the companion's curiosity; it must NOT draw
		# an ambient lamp on itself ... the salvage pass owns its look entirely.
		if i.pull > 1.0:
			continue
		match i.kind:
			"lamp":
				Glows.draw(self, Palette.LAMP, i.pos, 90.0, 0.22)
				draw_rect(Rect2(i.pos.x - 1, i.pos.y - 6, 2, 6), Palette.at(Palette.LAMP, 0.85))
			"arrangement":
				draw_rect(Rect2(i.pos.x - 10, i.pos.y - 3, 8, 6), Palette.at(Palette.EDGE, 0.9))
				draw_rect(Rect2(i.pos.x + 3, i.pos.y - 5, 7, 9), Palette.at(Palette.EDGE, 0.9))
				draw_rect(Rect2(i.pos.x - 14, i.pos.y + 6, 28, 2), Palette.at(Palette.EDGE, 0.9))
			_:
				var a := 0.55 + sin(t + i.pos.x) * 0.08
				draw_polyline(PackedVector2Array([i.pos + Vector2(-26, 10), i.pos + Vector2(0, -14), i.pos + Vector2(26, 10)]),
					Palette.at(Palette.EDGE, a), 2.0)
		if i.seen:
			draw_rect(Rect2(i.pos.x - 2, i.pos.y + 14, 4, 1), Palette.at(Palette.COMP, 0.35))

	# salvage. ⚠ the worn one is the one thing in the game that is WHITE, and it
	# breathes, and nothing else does either.
	for sv in w.salvage:
		if sv.frag != "":
			if sv.worn <= 0.0:
				draw_rect(Rect2(sv.pos.x - 3, sv.pos.y - 3, 6, 6), Palette.GLOW)
				Glows.draw(self, Palette.GLOW, sv.pos, 26.0, 0.30)
			else:
				var beat := 0.5 + sin(Time.get_ticks_msec() / 900.0) * 0.5
				var rad := 34.0 + 26.0 * beat
				Glows.draw(self, Palette.PLAYER_HI, sv.pos, rad, 0.22 + 0.20 * beat, 0.0, 0.45, 0.7)
				draw_rect(Rect2(sv.pos.x - 2.5, sv.pos.y - 2.5, 5, 5), Palette.at(Palette.PLAYER_HI, 0.75 + 0.25 * beat))
		else:
			draw_rect(Rect2(sv.pos.x - 3, sv.pos.y - 3, 6, 6), Palette.SALVAGE)

	# the chassis, before it is anything
	if w.has_chassis and not w.chassis_taken:
		draw_rect(Rect2(w.chassis_pos.x - 6, w.chassis_pos.y - 6, 12, 12), Palette.at(Palette.COMP_DIM, 0.85))
		draw_rect(Rect2(w.chassis_pos.x - 11, w.chassis_pos.y - 11, 22, 22), Palette.at(Palette.COMP, 0.30), false, 1.0)

	# ── the storyline, drawn. every piece mechanical. none of it explained. ──
	# 🚨 THE DORMANT ONE (34q): beside you at wake. broken, dark, except one light
	# that blinks when it says its word. it faces east. everything about it is a
	# fact the player reads, never a story they are told.
	_shadow(w.dormant_pos, 10.0)
	Sprites.wreck(self, w.dormant_pos, 16.0, 4242, false)
	# the one light still on in it, pulsing on its word timer
	var dphase := 1.0 - clampf(w.dormant_next / Tuning.DORMANT_EVERY, 0.0, 1.0)
	var dglow := 0.25 if dphase > 0.93 else 0.10
	draw_rect(Rect2(w.dormant_pos.x - 1, w.dormant_pos.y - 10.0, 2, 2), Palette.at(Palette.GLOW, dglow))

	# THE STILL (34b): rows, neat, facing one direction. drawn only once you are
	# near enough to have found it ... found, never signposted.
	if w.still_found:
		for st in w.still_rows:
			if st.taken:
				# the gap where one used to be. the game does not comment on it either.
				continue
			_shadow(st.pos, 9.0)
			# intact, upright, all facing east. the tell that they CHOSE is the neatness.
			draw_rect(Rect2(st.pos.x - 6, st.pos.y - 9, 12, 18), Palette.at(Palette.STOPPED, 1.0))
			draw_rect(Rect2(st.pos.x - 6, st.pos.y - 9, 12, 2), Palette.at(Palette.MACHINE_HI, 0.3))
			draw_rect(Rect2(st.pos.x + 4, st.pos.y - 5, 2, 2), Palette.at(Palette.LAMP, 0.5))

	# the repair unit (34f): a maintenance machine with a lit bay, immobile
	_shadow(w.repair_pos, 13.0)
	draw_rect(Rect2(w.repair_pos.x - 12, w.repair_pos.y - 10, 24, 20), Palette.MACHINE.lerp(Palette.GROUND2, 0.2))
	draw_rect(Rect2(w.repair_pos.x - 12, w.repair_pos.y - 10, 24, 3), Palette.at(Palette.MACHINE_HI, 0.5))
	# its bay light breathes warmer when it is actually working on your companion
	var working: bool = w.mind != null and w.companion_hp < w.companion_max_hp \
		and w.player_pos.distance_to(w.repair_pos) < Tuning.REPAIR_RANGE
	var bay := 0.4 + (0.3 if working else 0.0) + sin(t * 2.2) * 0.1
	Glows.draw(self, Palette.LAMP, w.repair_pos + Vector2(0, 2), 34.0, bay)

	# the foreman (34f): a taller unit with a clipboard light. after its manifest
	# completes, it powers down and its light goes out. that is all.
	_shadow(w.foreman_pos, 10.0)
	draw_rect(Rect2(w.foreman_pos.x - 7, w.foreman_pos.y - 16, 14, 32), Palette.MACHINE.lerp(Palette.VOID, 0.15))
	draw_rect(Rect2(w.foreman_pos.x - 7, w.foreman_pos.y - 16, 14, 2), Palette.at(Palette.MACHINE_HI, 0.45))
	if not w.foreman_finished:
		draw_rect(Rect2(w.foreman_pos.x + 5, w.foreman_pos.y - 12, 2, 2), Palette.at(Palette.LAMP, 0.8))
	else:
		# done. stopped. the light is out. take its fragments or leave them.
		pass

	# the commissary (34f): a shuttered kiosk, one lit menu panel
	_shadow(w.commissary_pos, 12.0)
	draw_rect(Rect2(w.commissary_pos.x - 14, w.commissary_pos.y - 10, 28, 20), Palette.MACHINE.lerp(Palette.GROUND2, 0.35))
	draw_rect(Rect2(w.commissary_pos.x - 10, w.commissary_pos.y - 6, 20, 8), Palette.at(Palette.VOID, 0.8))
	draw_rect(Rect2(w.commissary_pos.x - 10, w.commissary_pos.y - 6, 20, 1), Palette.at(Palette.LAMP, 0.5))
	if w.scrip > 0:
		draw_string(ThemeDB.fallback_font, w.commissary_pos + Vector2(18, -8), "scrip %d" % w.scrip,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 9, Palette.at(Palette.SALVAGE, 0.7))

	# the handler by degree 2 (34l): it will not leave. drawn only once found.
	# ⚠ it faces the door. east. always. that is the whole story and it is one pixel.
	if w.waiting_dog_found and not w.waiting_dog_taken:
		_shadow(w.waiting_dog_pos + Vector2(0, 2), 7.0)
		var bob2 := sin(t * 2.0) * 0.4   # it breathes. it is on. it is not going anywhere.
		draw_rect(Rect2(w.waiting_dog_pos.x - 6, w.waiting_dog_pos.y - 3 + bob2, 12, 6),
			Palette.LAMP.lerp(Palette.MACHINE, 0.55))
		draw_rect(Rect2(w.waiting_dog_pos.x + 4, w.waiting_dog_pos.y - 6 + bob2, 5, 5),
			Palette.LAMP.lerp(Palette.MACHINE, 0.55))
		draw_rect(Rect2(w.waiting_dog_pos.x + 6, w.waiting_dog_pos.y - 5 + bob2, 2, 2),
			Palette.at(Palette.LAMP, 0.9))

	# what is buried (34i §2): no marker. the only tell is the ground itself ...
	# a faint seam in the floor where something was put down long ago, and your
	# companion's dig ring while it works. a dull machine shows you nothing.
	for b in w.buried:
		if b.done:
			continue
		if w.player_pos.distance_to(b.pos) < 260.0:
			draw_rect(Rect2(b.pos.x - 5, b.pos.y - 3, 10, 6), Palette.at(Palette.GROUND2, 0.9))
			draw_rect(Rect2(b.pos.x - 5, b.pos.y - 3, 10, 1), Palette.at(Palette.EDGE, 0.35))
		if b.dig > 0.0:
			var dp := clampf(b.dig / Tuning.BURIED_DIG, 0.0, 1.0)
			draw_arc(w.companion_pos, 14.0, -PI / 2.0, -PI / 2.0 + dp * TAU, 24, Palette.at(Palette.COMP, 0.7), 1.5)

	# 🚨 THE DOOR (34r): the landmark's threshold, drawn as a standing opening in a
	# hull wall. no marker, no prompt, no label. it is passable when it is passable.
	draw_rect(Rect2(w.door_pos.x - 16, w.door_pos.y - 30, 32, 60), Palette.at(Palette.VOID, 0.9))
	draw_rect(Rect2(w.door_pos.x - 16, w.door_pos.y - 30, 32, 60), Palette.at(Palette.STRUCTURE, 0.9), false, 2.0)
	if w.mind != null and w.mind.live_fragments().size() >= Tuning.DOOR_FRAGS:
		# it is passable now. the opening holds a faint light that was not there before.
		Glows.draw(self, Palette.COMP, w.door_pos, 40.0, 0.10 + sin(t * 0.8) * 0.03)

	# threats
	for th in w.threats:
		if not th.alive:
			continue
		_shadow(th.pos, th.r * (1.8 if th.kind == "warden" else 1.2))
		if th.kind == "stopped":
			# IND-34l: drawn as a wreck ... the only tell is one lit light.
			Sprites.wreck(self, th.pos, th.r * 1.5, th.seed_v, true)
			continue
		if th.kind == "loop":
			Sprites.loop_machine(self, th.pos, th.seed_v, th.life / maxf(0.01, Tuning.LOOP_LIFE), th.heading)
			continue
		if th.kind == "scav":
			var sw := -1.0
			if th.stolen != null:
				sw = th.stolen.worn
			Sprites.scav(self, th.pos, th.seed_v, th.wind, sw)
			continue
		if th.kind == "herder":
			var charge: float = clampf(1.0 - (th.pulse_at - w.t) / Tuning.HERDER_PULSE_EVERY, 0.0, 1.0)
			Sprites.herder(self, th.pos, th.seed_v, th.heading, charge)
			continue
		if th.kind == "pest":
			Sprites.pest(self, th.pos, th.seed_v, t)
			continue
		if th.kind == "dray":
			Sprites.dray(self, th.pos, th.seed_v)
			continue
		match th.kind:
			"warden":
				Sprites.warden(self, th.pos, th.r, th.wind)
			"caster":
				Sprites.caster(self, th.pos, th.r, th.seed_v, th.wind)
			_:
				Sprites.machine(self, th.pos, th.r, th.seed_v, th.wind)
		if th.hp < th.max_hp:
			var bw := 44.0 if th.kind == "warden" else 22.0
			draw_rect(Rect2(th.pos.x - bw / 2, th.pos.y - th.r - 12, bw, 2), Palette.at(Palette.HARM_DIM, 0.9))
			# clamped. the renderer refuses to lie, whatever the state says.
			draw_rect(Rect2(th.pos.x - bw / 2, th.pos.y - th.r - 12, bw * maxf(0.0, th.hp / th.max_hp), 2), Palette.HARM)

	if w.handler != null and w.handler.alive:
		_shadow(w.handler.pos + Vector2(0, 2), 8.0)
		Sprites.handler(self, w.handler.pos, w.handler.bob)

	# THE ANCHOR. warm, so it reads as the one safe thing without a word of tutorial.
	var breathe := 0.5 + sin(w.t * 0.9) * 0.12
	Glows.draw(self, Palette.LAMP, w.anchor, 70.0, 0.14 * breathe)
	draw_arc(w.anchor, 26.0, 0.0, TAU, 32, Palette.at(Palette.LAMP, 0.34), 1.0)
	for k in 4:
		var thk := k * PI / 2.0 + PI / 4.0
		draw_rect(Rect2(w.anchor.x + cos(thk) * 26.0 - 1, w.anchor.y + sin(thk) * 26.0 - 1, 2, 2), Palette.at(Palette.LAMP, 0.7))

	# incoming fire is the only saturated colour that moves
	for b in w.bullets:
		if b.from == "threat":
			Glows.draw(self, Palette.HARM, b.pos, 11.0, 0.5)
			draw_rect(Rect2(b.pos.x - 2.5, b.pos.y - 2.5, 5, 5), Palette.HARM)
		else:
			draw_rect(Rect2(b.pos.x - 1.5, b.pos.y - 1.5, 3, 3), Palette.LAMP)

	# IND-34c: it stays where you fell. it waits. and it is VISIBLE from a distance.
	if w.waiting_mind != null:
		var pulse := 0.35 + sin(Time.get_ticks_msec() / 1400.0) * 0.25
		Glows.draw(self, Palette.COMP, w.waiting_pos, 86.0, 0.13 * (1.0 + pulse))
		draw_rect(Rect2(w.waiting_pos.x - 5, w.waiting_pos.y - 5, 10, 10), Palette.at(Palette.COMP_DIM, 0.95))
		for k2 in w.waiting_mind.live_fragments().size():
			draw_rect(Rect2(w.waiting_pos.x - 5 + k2 * 4, w.waiting_pos.y + 6, 3, 2), Palette.at(Palette.COMP, 0.55))
		draw_rect(Rect2(w.waiting_pos.x - 1, w.waiting_pos.y - 2, 2, 2), Palette.at(Palette.GLOW, 0.4 + pulse))

	if w.mind != null:
		_shadow(w.companion_pos, 7.0)
		var ids: Array = []
		for fr in w.mind.live_fragments():
			ids.append(fr.id)
		var comp_moving := w.companion_pos.distance_to(w.companion_prev) > 0.5
		var heading := (w.companion_pos - w.companion_prev).normalized()
		Sprites.companion(self, w.companion_pos, w.mind.live_fragments().size(), w.exposure,
			1.0 - w.companion_hp / w.companion_max_hp, w.mind.empty_sockets(),
			w.mending > 0.0, w.mind.facing, w.mind.marked != null,
			ids, comp_moving, heading)

	_shadow(w.player_pos, 8.0)
	var p_moving := w.player_pos.distance_to(w.player_prev) > 0.5
	Sprites.player(self, w.player_pos, w.t - w.last_hurt < 0.12, w.player_retreating,
		p_moving, (w.player_pos - w.player_prev).normalized())

	# 🚨 THE DUST. inside the camera transform, so you watch it arrive from across the
	# map ... weather you cannot see coming is a random punishment.
	if w.weather != null:
		var x := w.weather
		var body := Glows.sprite(Palette.DUST, maxf(64.0, roundf(x.r / 32.0) * 32.0), 0.18, 0.55, 0.60)
		draw_texture_rect(body, Rect2(x.pos - Vector2(x.r, x.r), Vector2(x.r * 2, x.r * 2)),
			false, Color(1, 1, 1, x.strength * 0.5))
		for i3 in 5:
			var ph := w.t * (0.25 + i3 * 0.05) + i3 * 1.7
			var bp := x.pos + Vector2(cos(ph) * x.r * 0.5, sin(ph * 0.7) * x.r * 0.34)
			var br := x.r * (0.30 + (i3 % 3) * 0.09)
			draw_texture_rect(body, Rect2(bp - Vector2(br, br), Vector2(br * 2, br * 2)),
				false, Color(1, 1, 1, x.strength * 0.34))

	# the ground ENDS rather than being CUT
	_edge_fade()


## a soft dark pool under a thing, so it stands ON the ground instead of floating in
## front of it. the single cheapest de-flattening move in 2D.
func _shadow(pos: Vector2, r: float) -> void:
	var tex := Glows.sprite(Palette.VOID, 32.0, 0.25, 0.55, 0.5)
	draw_texture_rect(tex, Rect2(pos.x - r * 1.1, pos.y + r * 0.15, r * 2.2, r * 1.05),
		false, Color(1, 1, 1, 0.52))


func _edge_fade() -> void:
	const FADE := 190.0
	var clear := Palette.at(Palette.VOID, 0.0)
	var solid := Palette.at(Palette.VOID, 0.98)
	_grad_quad(Vector2(Tuning.W - FADE, -400), Vector2(Tuning.W + 400, Tuning.H + 400), clear, solid, true)
	_grad_quad(Vector2(-400, -400), Vector2(FADE, Tuning.H + 400), solid, clear, true)
	_grad_quad(Vector2(-400, Tuning.H - FADE), Vector2(Tuning.W + 400, Tuning.H + 400), clear, solid, false)
	_grad_quad(Vector2(-400, -400), Vector2(Tuning.W + 400, FADE), solid, clear, false)


func _grad_quad(a: Vector2, b: Vector2, from_c: Color, to_c: Color, horizontal: bool) -> void:
	var pts := PackedVector2Array([a, Vector2(b.x, a.y), b, Vector2(a.x, b.y)])
	var cols := PackedColorArray([from_c, to_c, to_c, from_c]) if horizontal \
		else PackedColorArray([from_c, from_c, to_c, to_c])
	draw_polygon(pts, cols)


func _drive_script() -> Vector2:
	if _script_steps.is_empty():
		get_tree().quit(0)
		return Vector2.ZERO
	var step: Array = _script_steps[0]
	_frame += 1
	if _frame >= int(step[0]):
		_frame = 0
		var label: String = step[2]
		_script_steps.pop_front()
		_capture(label)   # ⚠ separate coroutine; awaiting here breaks the driver
	return step[1]


func _capture(label: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	DirAccess.make_dir_recursive_absolute("user://shots")
	var path := "user://shots/%s.png" % label
	img.save_png(path)
	print("[shot] %s -> %s" % [label, ProjectSettings.globalize_path(path)])
