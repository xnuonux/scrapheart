extends Node2D
class_name LightRig

## the 2D light pool. IND-34m: "light does most of the work. cheapest atmosphere
## available in 2D" ... and with real PointLight2Ds it falls on the ground shader,
## the wrecks, the machines. warm light stays the EXCEPTION: the anchor, the lamps,
## the warden's work light, a muzzle for one frame. the companion is the one cool one.
##
## a fixed pool, repositioned every frame from world state. never allocated in play.

const POOL := 24

var lights: Array = []
var muzzle_ttl := 0.0


func _texture(radius: float) -> GradientTexture2D:
	return Glows.sprite(Color.WHITE, radius, 0.0, 0.4, 0.55)


func _ready() -> void:
	for i in POOL:
		var l := PointLight2D.new()
		l.texture = _texture(128.0)
		l.enabled = false
		l.blend_mode = Light2D.BLEND_MODE_ADD
		l.shadow_enabled = false
		add_child(l)
		lights.append(l)


func _take(idx: int, pos: Vector2, colour: Color, energy: float, scale_v: float) -> int:
	if idx >= POOL:
		return idx
	var l: PointLight2D = lights[idx]
	l.enabled = true
	l.position = pos
	l.color = colour
	l.energy = energy
	l.texture_scale = scale_v
	return idx + 1


func frame_update(w: GameWorld, dt: float) -> void:
	var i := 0
	var t := Time.get_ticks_msec() / 1000.0

	# the anchor: the one warm place in a cold field
	var breathe := 1.0 + sin(w.t * 0.9) * 0.12
	i = _take(i, w.anchor, Palette.LAMP, 1.25 * breathe, 2.0)

	# lamps among the things worth nothing
	for it in w.interest:
		if it.kind == "lamp" and it.pull <= 1.0:
			i = _take(i, it.pos, Palette.LAMP, 0.72 + sin(t * 1.3 + it.pos.x) * 0.08, 1.0)

	# the worn fragment breathes white ... the one white light in the game
	for sv in w.salvage:
		if sv.frag != "" and sv.worn > 0.0:
			var beat := 0.5 + sin(Time.get_ticks_msec() / 900.0) * 0.5
			i = _take(i, sv.pos, Palette.PLAYER_HI, 0.5 + 0.5 * beat, 0.8)

	# the companion's cool light, dimming as it is hurt
	if w.mind != null:
		var hurt := 1.0 - w.companion_hp / w.companion_max_hp
		var stutter := 1.0
		if hurt > Tuning.HURT_THRESHOLD:
			stutter = 1.0 if sin(t / 0.09) > 0.2 else 0.45
		i = _take(i, w.companion_pos, Palette.COMP, (0.55 - hurt * 0.3) * stutter, 0.7)
	if w.waiting_mind != null:
		var pulse := 0.35 + sin(Time.get_ticks_msec() / 1400.0) * 0.25
		i = _take(i, w.waiting_pos, Palette.COMP, 0.35 + pulse * 0.3, 0.9)

	# the player carries a faint warmth ... the living thing in the field
	i = _take(i, w.player_pos, Palette.PLAYER, 0.34, 0.85)

	# the handler's eye-light
	if w.handler != null and w.handler.alive:
		i = _take(i, w.handler.pos, Palette.LAMP, 0.4, 0.5)

	# warden work lights: amber, doing maintenance
	for th in w.threats:
		if th.alive and th.kind == "warden":
			var pulse2 := 0.5 + sin(t / 0.26) * 0.35
			i = _take(i, th.pos, Palette.LAMP, 0.35 * pulse2, 0.8)
		elif th.alive and th.kind == "stopped":
			i = _take(i, th.pos, Palette.LAMP, 0.16, 0.4)

	# muzzle: one bright frame, decaying fast
	muzzle_ttl = maxf(0.0, muzzle_ttl - dt)
	if muzzle_ttl > 0.0:
		i = _take(i, w.player_pos, Palette.LAMP, 1.3 * (muzzle_ttl / 0.06), 0.5)

	for j in range(i, POOL):
		lights[j].enabled = false


func flash_muzzle() -> void:
	muzzle_ttl = 0.06
